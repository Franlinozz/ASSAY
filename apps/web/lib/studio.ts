// Client-side Studio API — thin wrappers over the same-origin /api/asy proxy. The capability token
// travels in the query string (the capability URL IS the credential).

const base = '/api/asy'

async function jsonOrThrow(res: Response): Promise<unknown> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'request failed')
  return body
}

export interface Created {
  id: string
  token: string
  url: string
}

export async function createDossier(input: {
  name: string
  timezone: string
  email?: string
}): Promise<Created> {
  const res = await fetch(`${base}/studio/dossier`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res) as Promise<Created>
}

export async function fetchState(id: string, token: string): Promise<StudioState> {
  const res = await fetch(`${base}/d-state/${id}?t=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  return jsonOrThrow(res) as Promise<StudioState>
}

export async function ingest(
  id: string,
  token: string,
  body: Record<string, unknown>,
): Promise<{ jobId: string }> {
  const res = await fetch(`${base}/d/${id}/ingest?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return jsonOrThrow(res) as Promise<{ jobId: string }>
}

export async function updateClaim(
  id: string,
  token: string,
  claimId: string,
  action: 'confirm' | 'reject' | 'edit',
  patch: { text?: string; answer?: string } = {},
): Promise<unknown> {
  const res = await fetch(`${base}/d/${id}/claims/${claimId}?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...patch }),
  })
  return jsonOrThrow(res)
}

export async function submitBrief(id: string, token: string, jd: string): Promise<unknown> {
  const res = await fetch(`${base}/d/${id}/brief?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jd }),
  })
  return jsonOrThrow(res)
}

export async function startForge(
  id: string,
  token: string,
  selected?: string[],
): Promise<{ jobId: string }> {
  const res = await fetch(`${base}/d/${id}/forge?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(selected ? { selected } : {}),
  })
  return jsonOrThrow(res) as Promise<{ jobId: string }>
}

export async function jobStatus(
  id: string,
  token: string,
  jobId: string,
): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${base}/d/${id}/job/${jobId}?t=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  return jsonOrThrow(res) as Promise<{ status: string; error?: string }>
}

export interface FeedEvent {
  id: number
  role: string
  action: string
  at: string
}

export async function fetchEvents(
  id: string,
  token: string,
  since: number,
): Promise<{ events: FeedEvent[]; cursor: number }> {
  const res = await fetch(`${base}/d/${id}/events?t=${encodeURIComponent(token)}&since=${since}`, {
    cache: 'no-store',
  })
  return jsonOrThrow(res) as Promise<{ events: FeedEvent[]; cursor: number }>
}

export async function sealDossier(id: string, token: string): Promise<SealReceipt> {
  const res = await fetch(`${base}/d/${id}/seal?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return jsonOrThrow(res) as Promise<SealReceipt>
}

export async function createShare(
  id: string,
  token: string,
  config: { exposedClaimIds?: string[]; showContact: boolean; expiryDays: 7 | 30 | null },
): Promise<{ shareId: string; url: string; expiresAt: string | null }> {
  const res = await fetch(`${base}/d/${id}/share?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  })
  return jsonOrThrow(res) as Promise<{ shareId: string; url: string; expiresAt: string | null }>
}

export async function revokeShare(id: string, token: string): Promise<unknown> {
  const res = await fetch(`${base}/d/${id}/share/revoke?t=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return jsonOrThrow(res)
}

// ── types (mirror the server's getStudioState) ──
export type Tier = 'attested' | 'documented' | 'linked' | 'sealed'
export type ClaimStatus = 'extracted' | 'needs_confirmation' | 'confirmed' | 'rejected'

export interface StudioClaim {
  id: string
  text: string
  status: ClaimStatus
  strength: Tier
  tier: Tier
  tierExplanation: string
  numericFacts: Array<{ value: number; unit?: string; context: string }>
  evidenceIds: string[]
  question?: string
}

export interface StudioEvidence {
  id: string
  kind: string
  label: string
  fetchedOk?: boolean
}

export interface CoverageRow {
  requirement: string
  kind: 'must' | 'nice'
  status: 'strong' | 'partial' | 'confirm' | 'missing'
  note: string
  claimIds: string[]
}

export interface ForgeArtifact {
  id: string
  kind: string
  sentences: Array<{ text: string; claimIds: string[] }>
  fileUrl: string | null
}

export interface Report {
  artifactId: string
  artifactKind: string
  draftIndex: number
  pass: boolean
  hardPass: boolean
  craftPass: boolean
  craftWeightedMean: number
  craft: Array<{ axis: string; score: number }>
  hard: Array<{
    id: string
    title: string
    status: string
    findings: Array<{ code: string; detail: string }>
  }>
  repairBrief?: string
  standardVersion: string
}

export interface ForgeResult {
  artifacts: ForgeArtifact[]
  reports: Report[]
  rollup: { firstDraftPassed: number; finalPassed: number; artifacts: number; reports: number }
  parseBack: {
    fidelityPct: number
    fieldDiffs: Array<{ field: string; expected: string; got: string }>
    fieldsChecked: number
  } | null
  questions: string[]
  fileUrls: Record<string, string>
}

export interface SealReceipt {
  leaf: string
  manifestHash: string
  signer: string | null
  status: string
  chainId: number
  registry: string
  explorerLink: string
}

export interface StudioState {
  id: string
  stage: 'ledger' | 'brief' | 'forging' | 'forged' | 'sealed'
  createdAt: string
  profile: {
    fullName: string
    headline: string
    email: string
    timezone: string
    experiences: Array<{ org: string; title: string; startYm: string; endYm: string | null }>
    skills: string[]
  }
  evidence: StudioEvidence[]
  claims: StudioClaim[]
  counts: {
    total: number
    confirmed: number
    needsConfirmation: number
    extracted: number
    rejected: number
  }
  brief: {
    jdText: string
    requirements: Array<{ id: string; text: string; kind: 'must' | 'nice' }>
  } | null
  coverage: CoverageRow[] | null
  forge: ForgeResult | null
  seal: SealReceipt | null
  share: {
    shareId: string
    url: string
    revoked: boolean
    expiresAt: string | null
    config: { exposedClaimIds?: string[]; showContact?: boolean }
  } | null
}
