import type { ArtifactKind, Coverage, Dossier, Sentence, Finding } from '@xyndicate/assay-core'
import { assertRenderable, buildFactsBlock, toQuestions } from '@xyndicate/assay-core'
import type { ModelRouter } from '@xyndicate/providers'
import { sanitizeGap, type Gap } from '@xyndicate/providers'

// Evidence-constrained generation. The model returns [{text, claimIds}]; we run the assay-core
// claim gate BEFORE anything can render (guardrail #1). Violations trigger one auto-tightening
// reprompt; whatever still fails is converted to a user question — never rendered as prose.

export interface WriteInput {
  kind: ArtifactKind
  dossier: Dossier
  router: ModelRouter
  coverage?: Coverage[]
}

export interface WriteResult {
  kind: ArtifactKind
  sentences: Sentence[]
  questions: string[]
  gaps: Gap[]
}

const WRITER_SYSTEM =
  "You are Assay's evidence-constrained writer. Write only sentences you can attribute to a " +
  'confirmed claim ID from the FACTS BLOCK. Never invent employers, dates, numbers, or achievements. ' +
  'Attach the supporting claimIds to every sentence. Output strict JSON only.'

interface RawSentence {
  text: string
  claimIds: string[]
}

function coerceSentences(json: unknown): Sentence[] {
  if (!Array.isArray(json)) return []
  const out: Sentence[] = []
  for (const item of json) {
    if (item && typeof item === 'object' && typeof (item as RawSentence).text === 'string') {
      const raw = item as RawSentence
      out.push({
        text: raw.text,
        claimIds: Array.isArray(raw.claimIds) ? raw.claimIds.map(String) : [],
      })
    }
  }
  return out
}

// Gate each sentence individually so we can keep the good ones and question the rest.
function gate(
  sentences: Sentence[],
  dossier: Dossier,
): { passing: Sentence[]; findings: Finding[] } {
  const passing: Sentence[] = []
  const findings: Finding[] = []
  for (const s of sentences) {
    const f = assertRenderable([s], dossier.claims, dossier.evidence)
    if (f.length === 0) passing.push(s)
    else findings.push(...f)
  }
  return { passing, findings }
}

function kindInstruction(kind: ArtifactKind): string {
  switch (kind) {
    case 'cover_letter':
      return 'Write a concise cover letter body: 3–5 sentences, each citing a confirmed claim.'
    case 'story_bank':
      // Lead with the situation. Left to itself the writer opens on intent ("To eliminate
      // configuration drift, she built …") or straight on the achievement, which reads fine but
      // is not an interview story — the interviewer never learns what was true before the
      // candidate acted, and STAR_COMPLETENESS correctly fails it. Ordering is the instruction's
      // job, not the grader's: state the scene first, then task, action, result.
      return (
        'Write 2–4 STAR interview stories, one or two sentences each, each citing the confirmed claim it draws on. ' +
        // These are stories the candidate says out loud in a room. Demanding four explicit beats
        // inside a single sentence pushed the writer into agentless passive ("mentorship was
        // provided", "the effort led the migration") — grammatical, unsayable, and it hides the
        // one thing an interviewer is listening for: who did it. First person, active, with room
        // to breathe.
        'Write in the first person ("I …"), in the active voice, with the candidate as the subject of every action. ' +
        'Never write agentless passive constructions such as "mentorship was provided" or "a linter was built". ' +
        'Every story MUST open with the situation — the circumstances that already existed before any action, ' +
        'written as a scene-setting clause (for example "When deploys across 14 legacy services took 45 minutes, …" ' +
        'or "Facing inconsistent configuration across 9 teams, …"). After that clause the story must STATE — ' +
        'not merely imply — the three remaining beats in order: the task (what had to be achieved: ' +
        '"the goal was to …", "the team needed to …"), the action actually taken, and the measurable result. ' +
        'A story that jumps from the situation straight to what was built has stated no task and is incomplete. ' +
        'Never open on the action, the outcome, or the purpose ("To reduce…", "In order to…"). ' +
        'Write natural prose — do not emit "Situation:" / "Task:" / "Action:" / "Result:" labels.'
      )
    case 'promotion_narrative':
      return 'Write a concise performance-review narrative grouped by impact. Every sentence cites a confirmed claim.'
    case 'promotion_memo':
      return 'Write a promotion case memo that leads with scope and measurable impact. Every sentence cites a confirmed claim.'
    case 'manager_one_pager':
      return 'Write a skimmable manager one-pager of promotion evidence. Every sentence cites a confirmed claim.'
    case 'capability_statement':
      return 'Write a concise freelancer capability statement for this client brief. Every sentence cites a confirmed claim.'
    case 'case_studies':
      return 'Write short case-study cards only from the selected project claims. Every sentence cites a confirmed claim.'
    case 'proposal_letter':
      return 'Write a proposal letter tailored to the client brief. Every sentence cites a confirmed claim.'
    default:
      return 'Write resume achievement bullets, one sentence each, each citing the confirmed claim it draws on.'
  }
}

function buildWriterPrompt(kind: ArtifactKind, facts: string, coverage?: Coverage[]): string {
  const cov =
    coverage && coverage.length
      ? `\nCoverage priorities (address strong/partial first; never claim 'missing'):\n${coverage.map((c) => `- ${c.requirementId}: ${c.status}`).join('\n')}`
      : ''
  return [
    facts,
    kindInstruction(kind),
    cov,
    'Return JSON array: [{"text": string, "claimIds": ["CLM-..."]}]. Every sentence MUST cite at least one confirmed claim ID above, and any number in a sentence MUST appear in that claim\'s figures.',
  ].join('\n\n')
}

function tightenPrompt(basePrompt: string, findings: Finding[]): string {
  const problems = findings.map((f) => `- ${f.code}: ${f.detail}`).join('\n')
  return `${basePrompt}\n\nYour previous draft had unsupported content:\n${problems}\n\nRewrite. Output ONLY sentences that cite a confirmed claim ID and whose numbers appear in that claim's figures. Drop anything you cannot support.`
}

export async function writeArtifact(input: WriteInput): Promise<WriteResult> {
  const { kind, dossier, router, coverage } = input
  const confirmed = dossier.claims.filter((c) => c.status === 'confirmed')
  const facts = buildFactsBlock({
    profile: dossier.profile,
    ...(dossier.brief ? { brief: dossier.brief } : {}),
    claims: confirmed,
  })
  const basePrompt = buildWriterPrompt(kind, facts, coverage)
  const gaps: Gap[] = []

  const res = await router.generate(
    { role: 'writer', system: WRITER_SYSTEM, prompt: basePrompt, json: true },
    { dossierId: dossier.id },
  )
  if (res.degraded) {
    gaps.push(sanitizeGap(res.gap ?? 'PROVIDER_ERROR'))
    return { kind, sentences: [], questions: [], gaps }
  }

  let { passing, findings } = gate(coerceSentences(res.json), dossier)

  if (findings.length > 0) {
    const retry = await router.generate(
      {
        role: 'writer',
        system: WRITER_SYSTEM,
        prompt: tightenPrompt(basePrompt, findings),
        json: true,
      },
      { dossierId: dossier.id },
    )
    if (!retry.degraded) {
      const second = gate(coerceSentences(retry.json), dossier)
      passing = second.passing
      findings = second.findings
    }
  }

  return { kind, sentences: passing, questions: toQuestions(findings), gaps }
}
