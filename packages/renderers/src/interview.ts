import type {
  Artifact,
  Coverage,
  Dossier,
  InterviewEvaluation,
  InterviewQuestion,
  Sentence,
} from '@xyndicate/assay-core'
import { extractNumbers } from '@xyndicate/assay-core'
import type { ModelRouter } from '@xyndicate/providers'

const WORD = /[a-z][a-z0-9+#.-]{2,}/gi
const STOP = new Set([
  'the',
  'and',
  'that',
  'with',
  'from',
  'your',
  'this',
  'what',
  'when',
  'where',
])

function words(text: string): Set<string> {
  return new Set((text.match(WORD) ?? []).map((x) => x.toLowerCase()).filter((x) => !STOP.has(x)))
}

export function generateInterviewQuestions(
  dossier: Dossier,
  coverage: Coverage[],
  limit = 8,
): InterviewQuestion[] {
  const out: InterviewQuestion[] = []
  const confirmed = dossier.claims.filter((c) => c.status === 'confirmed')
  for (const claim of confirmed.slice(0, 4)) {
    out.push({
      id: `iq_behavioral_${out.length + 1}`,
      kind: 'behavioral',
      prompt: `Tell me about the situation behind “${claim.text}”. What was your task, what action did you personally take, and what changed?`,
      claimIds: [claim.id],
    })
  }
  for (const row of coverage.filter((c) => c.status === 'missing')) {
    const req = dossier.brief?.decomposed.find((r) => r.id === row.requirementId)
    out.push({
      id: `iq_gap_${out.length + 1}`,
      kind: 'gap',
      prompt: `Your ledger does not yet show “${req?.text ?? row.requirementId}”. What adjacent experience can you discuss without claiming direct experience you do not have?`,
      claimIds: [],
      requirementId: row.requirementId,
    })
  }
  return out.slice(0, limit)
}

interface CriticShape {
  star?: Partial<Record<'situation' | 'task' | 'action' | 'result', boolean>>
  relevance?: number
  feedback?: string[]
}

function deterministicStar(answer: string): InterviewEvaluation['star'] {
  const has = (re: RegExp): boolean => re.test(answer)
  return {
    situation: has(/\b(situation|context|when|while|at the time|the challenge)\b/i),
    task: has(/\b(task|goal|needed to|responsible|objective)\b/i),
    action: has(
      /\b(i|we)\s+(built|led|changed|created|implemented|designed|analysed|analyzed|worked|decided|introduced|reduced|improved)\b/i,
    ),
    result: has(
      /\b(result|outcome|therefore|which (?:cut|grew|reduced|improved)|\d+(?:\.\d+)?%?)\b/i,
    ),
  }
}

function deterministicRelevance(
  question: InterviewQuestion,
  dossier: Dossier,
  answer: string,
): number {
  const q = words(question.prompt)
  const claimText = dossier.claims
    .filter((c) => question.claimIds.includes(c.id))
    .map((c) => c.text)
    .join(' ')
  for (const w of words(claimText)) q.add(w)
  if (q.size === 0) return answer.trim().length > 40 ? 70 : 40
  const a = words(answer)
  const overlap = [...q].filter((w) => a.has(w)).length
  return Math.max(25, Math.min(100, Math.round((overlap / Math.min(q.size, 8)) * 100)))
}

// Crude stem so "reduced" / "reduction" and "migrate" / "migration" line up. Deterministic, and
// local to this file so the renderers keep no runtime dependency on the providers package.
function stem(word: string): string {
  let w = word.toLowerCase()
  if (w.length > 5) w = w.replace(/(ations?|tions?|ions?|ings?|ed)$/, '')
  if (w.length > 4) w = w.replace(/e?s$/, '')
  return w
}

// Measurement families. A candidate says "I led 12 people"; the ledger recorded "team size" — the
// same quantity in different words, and a contradiction worth surfacing. Nothing here is clever:
// it is a short, closed list of the quantities career evidence actually measures, so that a
// synonym does not read as a different subject. Anything outside it must match on words.
const MEASUREMENT_FAMILIES: string[][] = [
  ['team', 'people', 'person', 'headcount', 'engineer', 'staff', 'report', 'direct', 'hire'],
  ['latency', 'speed', 'duration', 'time', 'cycl', 'deploy', 'respons', 'wait'],
  ['revenue', 'sale', 'arr', 'mrr', 'bookings', 'income'],
  ['cost', 'spend', 'budget', 'saving'],
  ['user', 'custom', 'account', 'subscrib', 'client', 'member'],
  ['uptim', 'availabl', 'reliab'],
  ['error', 'defect', 'bug', 'incident', 'failur', 'exception'],
]
const FAMILY_OF = new Map<string, number>()
MEASUREMENT_FAMILIES.forEach((family, index) => {
  for (const word of family) FAMILY_OF.set(word, index)
})

function familyOf(token: string): number | undefined {
  const direct = FAMILY_OF.get(token)
  if (direct !== undefined) return direct
  // Family members are stems, so "engineers" → "engineer" and "customers" → "custom" both land.
  for (const [word, index] of FAMILY_OF) if (token.startsWith(word)) return index
  return undefined
}

interface Subject {
  tokens: Set<string>
  families: Set<number>
}

function subjectTokens(text: string): Subject {
  const tokens = new Set<string>()
  const families = new Set<number>()
  for (const w of text.match(WORD) ?? []) {
    const lower = w.toLowerCase()
    if (STOP.has(lower) || SUBJECT_STOP.has(lower)) continue
    const s = stem(lower)
    if (s.length < 3) continue
    tokens.add(s)
    const family = familyOf(s)
    if (family !== undefined) families.add(family)
  }
  return { tokens, families }
}

/** Two figures measure the same thing if they share a word, or share a measurement family. */
function measuresTheSameThing(answer: Subject, fact: Subject): boolean {
  if (fact.tokens.size === 0) return true
  for (const t of fact.tokens) if (answer.tokens.has(t)) return true
  for (const f of fact.families) if (answer.families.has(f)) return true
  return false
}

// Words that appear around almost any figure and so prove nothing about what is being measured.
const SUBJECT_STOP = new Set([
  'about',
  'around',
  'approximately',
  'roughly',
  'over',
  'under',
  'more',
  'less',
  'than',
  'was',
  'were',
  'have',
  'had',
  'has',
  'our',
  'their',
  'its',
  'been',
  'into',
  'down',
  'percent',
  'total',
])

/** The words immediately around a figure — what that figure is actually measuring. */
function contextAround(text: string, raw: string, from: number): { window: string; next: number } {
  const at = text.indexOf(raw, from)
  if (at < 0) return { window: text, next: from }
  const before = text.slice(Math.max(0, at - 90), at)
  const after = text.slice(at + raw.length, at + raw.length + 60)
  return { window: `${before} ${after}`, next: at + raw.length }
}

export function findLedgerContradictions(
  dossier: Dossier,
  question: InterviewQuestion,
  answer: string,
): InterviewEvaluation['contradictions'] {
  // Numbers are compared WITHIN a unit, never positionally. Pairing an answer's "20 people"
  // against a claim's "840 ms" produced the right verdict for the wrong reason — and a figure the
  // ledger simply does not carry is unverified, not contradicted. Only a same-unit disagreement is
  // a contradiction, and it is reported against the fact it actually disagrees with.
  //
  // Matching units, though, is necessary and NOT sufficient. A live evaluation reported "You said
  // 61 %; your confirmed ledger says 0.4 %" — a data-completeness figure indicted by a migration
  // exception rate, because both happen to be percentages. Two numbers only disagree if they
  // measure the same thing, so the words around the figure must overlap the words the ledger
  // recorded alongside the fact. Where the ledger kept no context, unit agreement is all we have
  // and the old behaviour stands.
  const claims = dossier.claims.filter((c) => question.claimIds.includes(c.id))
  const out: InterviewEvaluation['contradictions'] = []
  const same = (a: number, b: number): boolean => Math.abs(a - b) < 0.000001

  let cursor = 0
  const answerNumbers = extractNumbers(answer)
    .map((n) => {
      const { window, next } = contextAround(answer, n.raw, cursor)
      cursor = next
      return { ...n, subject: subjectTokens(window) }
    })
    // Bare years are dates, not measurements.
    .filter((n) => n.value < 1900 || n.value > 2100)
  if (answerNumbers.length === 0) return []

  for (const claim of claims) {
    if (claim.numericFacts.length === 0) continue
    for (const number of answerNumbers) {
      const comparable = claim.numericFacts.filter((f) => {
        if ((f.unit ?? '') !== number.unit) return false
        // The fact's own context is the tightest statement of what it measures; where the ledger
        // kept none, the claim sentence it came from is the next best thing.
        const context = f.context?.trim() || claim.text
        return measuresTheSameThing(number.subject, subjectTokens(context))
      })
      // No fact in this claim measures the same thing — nothing to contradict.
      if (comparable.length === 0) continue
      if (comparable.some((f) => same(f.value, number.value))) continue
      const conflicting = comparable[0]!
      const unit = number.unit ? ` ${number.unit}` : ''
      out.push({
        answerValue: number.value,
        ledgerValue: conflicting.value,
        claimId: claim.id,
        detail: `You said ${number.value}${unit}; your confirmed ledger says ${conflicting.value}${unit}. Correct the ledger with evidence, or correct the answer.`,
      })
    }
  }
  return out
}

export async function evaluateInterviewAnswer(input: {
  dossier: Dossier
  question: InterviewQuestion
  answer: string
  router: ModelRouter
}): Promise<InterviewEvaluation> {
  const { dossier, question, answer, router } = input
  const contradictions = findLedgerContradictions(dossier, question, answer)
  const deterministic = deterministicStar(answer)
  const res = await router.generate(
    {
      role: 'critic',
      system:
        'You evaluate, never impersonate an interviewer. Return strict JSON. Assess STAR structure and relevance only; do not invent candidate facts.',
      prompt: [
        `Question: ${question.prompt}`,
        `Answer: ${answer}`,
        'Return {"star":{"situation":boolean,"task":boolean,"action":boolean,"result":boolean},"relevance":0-100,"feedback":["short structural note"]}.',
      ].join('\n\n'),
      json: true,
    },
    { dossierId: dossier.id },
  )
  const raw = (
    !res.degraded && res.json && typeof res.json === 'object' ? res.json : {}
  ) as CriticShape
  const star = {
    situation: raw.star?.situation ?? deterministic.situation,
    task: raw.star?.task ?? deterministic.task,
    action: raw.star?.action ?? deterministic.action,
    result: raw.star?.result ?? deterministic.result,
  }
  const relevance =
    typeof raw.relevance === 'number' && Number.isFinite(raw.relevance)
      ? Math.max(0, Math.min(100, Math.round(raw.relevance)))
      : deterministicRelevance(question, dossier, answer)
  const missing = Object.entries(star)
    .filter(([, present]) => !present)
    .map(([part]) => part)
  const feedbackText = [
    ...(Array.isArray(raw.feedback)
      ? raw.feedback.filter((x): x is string => typeof x === 'string')
      : []),
    ...(missing.length ? [`Make the ${missing.join(', ')} part explicit.`] : []),
    ...contradictions.map((c) => c.detail),
  ].slice(0, 4)
  const feedback: Sentence[] = feedbackText.map((text) => ({ text, claimIds: question.claimIds }))
  return {
    questionId: question.id,
    answer,
    claimIds: question.claimIds,
    star,
    relevance,
    feedback,
    contradictions,
    final: contradictions.length === 0 && Object.values(star).every(Boolean) && relevance >= 60,
    evaluatedAt: new Date().toISOString(),
  }
}

export function buildInterviewArtifact(evaluations: InterviewEvaluation[]): Artifact {
  return {
    id: 'interview_evaluation',
    kind: 'interview_evaluation',
    meta: {
      evaluations,
      ledgerContradictions: evaluations.flatMap((e) => e.contradictions),
      incompleteStar: evaluations
        .filter((e) => !Object.values(e.star).every(Boolean))
        .map((e) => e.questionId),
    },
  }
}
