import type { Claim, EvidenceItem, Profile } from '@xyndicate/assay-core'
import { ProfileSchema, computeStrength, newClaimId, newEvidenceId } from '@xyndicate/assay-core'
import type { ModelRouter } from './router'
import { EXTRACTION_SYSTEM, buildExtractionPrompt } from './prompts'
import { sanitizeGap, logRaw, type Gap } from './gaps'
import { significantTokens } from './text'

/** "2,400" and "1,612" become "2400" and "1612" so a formatted source matches an extracted value. */
export function stripThousands(text: string): string {
  return text.replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
}

/**
 * Does the source text actually carry this figure? Substring containment on a separator-stripped
 * source, which also lets a source that overshoots a stated floor ("4.83 mean" behind a claim of
 * "above 4.8") count as carrying it — the claim is true and must not be reported as invented.
 */
export function sourceCarries(sourceTextLower: string, value: number): boolean {
  return sourceTextLower.includes(String(value))
}

export interface IngestedDoc {
  label: string
  contentText: string
  sourceRef?: string
}

export interface ExtractInput {
  documents: IngestedDoc[]
  answers?: string
  router: ModelRouter
  dossierId?: string
}

export interface ExtractResult {
  profile: Profile
  claims: Claim[]
  evidence: EvidenceItem[]
  gaps: Gap[]
}

interface RawExtraction {
  profile?: {
    fullName?: string
    headline?: string
    contact?: { email?: string; phone?: string; links?: string[] }
    timezone?: string
    skills?: string[]
  }
  experiences?: Array<{
    org: string
    title: string
    startYm: string
    endYm: string | null
    location?: string
  }>
  claims?: Array<{
    text: string
    numericFacts?: Array<{ value: number; unit?: string; context: string }>
    tags?: string[]
  }>
}

const GROUNDED_THRESHOLD = 0.5

function emptyProfile(tz: string): Profile {
  return ProfileSchema.parse({ fullName: '', timezone: tz })
}

export async function extractProfile(input: ExtractInput): Promise<ExtractResult> {
  const gaps: Gap[] = []
  const evidence: EvidenceItem[] = []

  // One evidence item per document (kind 'document'), plus an attestation for typed answers.
  for (const doc of input.documents) {
    evidence.push({
      id: newEvidenceId(),
      kind: 'document',
      label: doc.label,
      sourceRef: doc.sourceRef ?? doc.label,
      contentText: doc.contentText,
      addedAt: new Date().toISOString(),
    })
  }
  if (input.answers && input.answers.trim()) {
    evidence.push({
      id: newEvidenceId(),
      kind: 'attestation',
      label: 'Typed answers',
      sourceRef: 'user-answers',
      contentText: input.answers,
      addedAt: new Date().toISOString(),
    })
  }

  const tz = 'UTC'
  const prompt = buildExtractionPrompt({
    documents: input.documents.map((d) => ({ label: d.label, text: d.contentText })),
    ...(input.answers ? { answers: input.answers } : {}),
  })

  const res = await input.router.generate(
    { role: 'extractor', system: EXTRACTION_SYSTEM, prompt, json: true },
    input.dossierId ? { dossierId: input.dossierId } : {},
  )
  if (res.degraded) {
    gaps.push(sanitizeGap(res.gap ?? 'PROVIDER_ERROR'))
    return { profile: emptyProfile(tz), claims: [], evidence, gaps }
  }

  const raw = res.json as RawExtraction
  let profile: Profile
  try {
    profile = ProfileSchema.parse({
      fullName: raw.profile?.fullName ?? '',
      ...(raw.profile?.headline ? { headline: raw.profile.headline } : {}),
      ...(raw.profile?.contact ? { contact: raw.profile.contact } : {}),
      timezone: raw.profile?.timezone ?? tz,
      experiences: (raw.experiences ?? [])
        .filter(
          (e) =>
            e &&
            typeof e.org === 'string' &&
            typeof e.title === 'string' &&
            typeof e.startYm === 'string',
        )
        .map((e) => ({
          org: e.org,
          title: e.title,
          startYm: e.startYm,
          endYm: typeof e.endYm === 'string' ? e.endYm : null,
          ...(typeof e.location === 'string' && e.location ? { location: e.location } : {}),
        })),
      skills: raw.profile?.skills ?? [],
    })
  } catch (e) {
    logRaw('PROVIDER_BADJSON', e)
    gaps.push(sanitizeGap('PROVIDER_BADJSON'))
    return { profile: emptyProfile(tz), claims: [], evidence, gaps }
  }

  // Source token set for the groundedness post-check.
  const sourceTokens = new Set<string>()
  for (const e of evidence)
    for (const t of significantTokens(e.contentText ?? '')) sourceTokens.add(t)
  // Thousands separators are the difference between "2,400 installs" in the source and the
  // extracted fact {value: 2400}. String(2400) is not a substring of "2,400", so EVERY figure at
  // or above a thousand came back unverified — a résumé's real numbers are exactly the ones this
  // hit, and asy_claim_audit reported them as UNSUPPORTED_NUMBER against evidence that stated them
  // verbatim. Strip the separators before asking whether the source carries the number.
  const sourceTextLower = stripThousands(
    evidence.map((e) => (e.contentText ?? '').toLowerCase()).join('\n'),
  )

  const claims: Claim[] = []
  const seen = new Set<string>()

  for (const rc of raw.claims ?? []) {
    const norm = rc.text.trim().toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(norm)) continue // dedupe
    seen.add(norm)

    const claimTokens = [...new Set(significantTokens(rc.text))]
    if (claimTokens.length === 0) continue
    const matched = claimTokens.filter((t) => sourceTokens.has(t)).length / claimTokens.length

    // Deterministic post-check: drop any claim whose text does not appear in the source evidence.
    if (matched < GROUNDED_THRESHOLD) {
      logRaw('EXTRACT_UNGROUNDED', `dropped ungrounded claim: ${rc.text}`)
      gaps.push(sanitizeGap('EXTRACT_UNGROUNDED'))
      continue
    }

    // Link to the evidence item with the strongest token overlap.
    const linked = bestEvidence(evidence, claimTokens)
    const evidenceIds = linked ? [linked.id] : []

    // A quantified claim whose number is absent from the source needs the user's confirmation.
    // Live models sometimes emit unit/context as null — coerce to schema-legal shapes.
    const numbers = (rc.numericFacts ?? [])
      .filter((f) => f && typeof f.value === 'number' && Number.isFinite(f.value))
      .map((f) => ({
        value: f.value,
        ...(typeof f.unit === 'string' && f.unit ? { unit: f.unit } : {}),
        context: typeof f.context === 'string' ? f.context : '',
      }))
    const numberMissing = numbers.some((f) => !sourceCarries(sourceTextLower, f.value))
    const status = numberMissing ? 'needs_confirmation' : 'extracted'

    const base: Claim = {
      id: newClaimId(),
      text: rc.text,
      evidenceIds,
      strength: 'attested',
      status,
      numericFacts: numbers,
      tags: rc.tags ?? [],
    }
    claims.push({ ...base, strength: computeStrength(base, evidence) })
  }

  return { profile, claims, evidence, gaps }
}

function bestEvidence(evidence: EvidenceItem[], claimTokens: string[]): EvidenceItem | undefined {
  let best: EvidenceItem | undefined
  let bestScore = 0
  for (const e of evidence) {
    const tokens = new Set(significantTokens(e.contentText ?? ''))
    const score = claimTokens.filter((t) => tokens.has(t)).length
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}
