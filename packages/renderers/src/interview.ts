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

export function findLedgerContradictions(
  dossier: Dossier,
  question: InterviewQuestion,
  answer: string,
): InterviewEvaluation['contradictions'] {
  // Numbers are compared WITHIN a unit, never positionally. Pairing an answer's "20 people"
  // against a claim's "840 ms" produced the right verdict for the wrong reason — and a figure the
  // ledger simply does not carry is unverified, not contradicted. Only a same-unit disagreement is
  // a contradiction, and it is reported against the fact it actually disagrees with.
  const answerNumbers = extractNumbers(answer).filter((n) => n.value < 1900 || n.value > 2100)
  if (answerNumbers.length === 0) return []
  const claims = dossier.claims.filter((c) => question.claimIds.includes(c.id))
  const out: InterviewEvaluation['contradictions'] = []
  const same = (a: number, b: number): boolean => Math.abs(a - b) < 0.000001
  for (const claim of claims) {
    if (claim.numericFacts.length === 0) continue
    for (const number of answerNumbers) {
      const comparable = claim.numericFacts.filter((f) => (f.unit ?? '') === number.unit)
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
