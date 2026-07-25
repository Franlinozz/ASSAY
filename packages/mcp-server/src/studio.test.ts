import { describe, it, expect } from 'vitest'
import { testRuntime, type TestRig } from './testutil'
import { devPdf } from './jobs'
import {
  createDossier,
  getStudioState,
  updateClaim,
  runStudioExtract,
  runBrief,
  runStudioForge,
  sealDossier,
  createOrUpdateShare,
  revokeShare,
  getShareView,
  type StudioDeps,
} from './studio'
import { signCapabilityToken, verifyCapabilityToken } from './util'

const SAMPLE = `Chidinma Eze — Senior Backend Engineer, Lagos. chidinma.eze@example.com.
EXPERIENCE
Paystack — Senior Backend Engineer (Mar 2021 – Present):
Reduced API p95 latency by 38% by introducing PostgreSQL connection pooling.
Scaled the payments service to 12000 requests per second during peak sales.
Andela — Backend Engineer (Jun 2018 – Feb 2021):
Mentored 5 junior engineers and led the migration to TypeScript.
SKILLS TypeScript, Node.js, PostgreSQL, Redis, Kubernetes`

function deps(rig: TestRig): StudioDeps {
  return {
    store: rig.store,
    router: rig.router,
    fetcher: rig.fetcher,
    cfg: rig.cfg,
    toPdf: devPdf,
    realPdf: false,
    sampleContrast: async () => 12.4,
  }
}

// getStudioState returns Record<string, unknown>; this test cast keeps the assertions readable.
interface TState {
  stage: string
  claims: Array<{ id: string; status: string; tier: string }>
  forge: {
    artifacts: Array<{ id: string; kind: string; sentences: Array<{ claimIds: string[] }> }>
  } | null
}
function stateOf(rig: TestRig, id: string): TState {
  return getStudioState(rig.store, rig.cfg, id)! as unknown as TState
}

async function buildConfirmed(rig: TestRig): Promise<{ id: string; token: string }> {
  const d = deps(rig)
  const { id, token } = createDossier(rig.store, rig.cfg, {
    name: 'Chidinma Eze',
    timezone: 'Africa/Lagos',
    email: 'chidinma.eze@example.com',
  })
  await runStudioExtract(d, {
    dossierId: id,
    kind: 'document',
    filename: 'resume.txt',
    text: SAMPLE,
  })
  const state = stateOf(rig, id)
  for (const c of state.claims as Array<{ id: string }>) updateClaim(rig.store, id, c.id, 'confirm')
  return { id, token }
}

describe('capability tokens', () => {
  it('round-trips and rejects tampering', () => {
    const t = signCapabilityToken('secret', 'DSR-ABC')
    expect(verifyCapabilityToken('secret', 'DSR-ABC', t)).toBe(true)
    expect(verifyCapabilityToken('secret', 'DSR-XYZ', t)).toBe(false)
    expect(verifyCapabilityToken('other', 'DSR-ABC', t)).toBe(false)
    expect(verifyCapabilityToken('secret', 'DSR-ABC', '')).toBe(false)
  })
})

describe('studio flow', () => {
  it('creates a dossier at the ledger stage with a valid token', () => {
    const rig = testRuntime()
    const created = createDossier(rig.store, rig.cfg, { name: 'Ada Lovelace', timezone: 'UTC' })
    expect(created.id).toMatch(/^DSR-/)
    expect(created.url).toContain(created.token)
    expect(verifyCapabilityToken(rig.cfg.signingSecret, created.id, created.token)).toBe(true)
    const state = stateOf(rig, created.id)
    expect(state.stage).toBe('ledger')
    expect(state.claims).toHaveLength(0)
  })

  it('extracts claims from an uploaded résumé and files them with tiers', async () => {
    const rig = testRuntime()
    const { id } = createDossier(rig.store, rig.cfg, { name: 'Chidinma Eze', timezone: 'UTC' })
    await runStudioExtract(deps(rig), {
      dossierId: id,
      kind: 'document',
      filename: 'resume.txt',
      text: SAMPLE,
    })
    const state = stateOf(rig, id)
    expect(state.claims.length).toBeGreaterThan(0)
    expect(
      state.claims.every((c) => ['documented', 'attested', 'linked', 'sealed'].includes(c.tier)),
    ).toBe(true)
    // A live "role · action" feed was recorded.
    const events = rig.store.listStudioEventsSince(id, 0)
    expect(events.some((e) => e.role === 'Extractor')).toBe(true)
  })

  it('confirms claims, and a needs_confirmation answer attaches an attestation', async () => {
    const rig = testRuntime()
    const { id } = createDossier(rig.store, rig.cfg, { name: 'X', timezone: 'UTC' })
    await runStudioExtract(deps(rig), {
      dossierId: id,
      kind: 'document',
      filename: 'r.txt',
      text: SAMPLE,
    })
    const first = stateOf(rig, id).claims[0]!
    const r = updateClaim(rig.store, id, first.id, 'confirm', {
      answer: '38% — from my 2023 review',
    })
    expect(r.ok).toBe(true)
    const after = stateOf(rig, id)
    expect(after.claims.find((c) => c.id === first.id)!.status).toBe('confirmed')
  })

  it('maps a brief with an honest missing row', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    const res = (await runBrief(
      deps(rig),
      id,
      [
        '- PostgreSQL connection pooling required',
        '- Rust systems programming experience is required',
      ].join('\n'),
    )) as { coverage: Array<{ status: string }> }
    expect(res.coverage.some((c) => c.status === 'missing')).toBe(true)
    expect(stateOf(rig, id).stage).toBe('brief')
  })

  it('forges evidence-cited artifacts and grades them', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    await runBrief(deps(rig), id, '- Backend engineering with PostgreSQL')
    await runStudioForge(deps(rig), { dossierId: id })
    const state = stateOf(rig, id)
    expect(state.stage).toBe('forged')
    expect(state.forge).not.toBeNull()
    expect(state.forge!.artifacts.length).toBeGreaterThan(0)
    // Every prose sentence carries at least one claim id (the claim gate held).
    const prose = state.forge!.artifacts.filter((a) => a.sentences.length > 0)
    expect(prose.length).toBeGreaterThan(0)
    for (const a of prose) for (const s of a.sentences) expect(s.claimIds.length).toBeGreaterThan(0)
  })

  it('re-forges as vN+1 and keeps each version seal independently', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    await runBrief(deps(rig), id, '- Backend engineering with PostgreSQL')
    await runStudioForge(deps(rig), { dossierId: id, selected: ['manifest_json'] })
    const first = await sealDossier(deps(rig), id)
    const salt1 = rig.store.getSalt(`${id}@v1`)

    await runStudioForge(deps(rig), { dossierId: id, selected: ['manifest_json'] })
    const second = await sealDossier(deps(rig), id)
    const salt2 = rig.store.getSalt(`${id}@v2`)

    expect(rig.store.listDossierVersions(id).map((version) => version.version)).toEqual([1, 2])
    expect(salt1).toBeTruthy()
    expect(salt2).toBeTruthy()
    expect(salt2).not.toBe(salt1)
    expect(first.leaf).not.toBe(second.leaf)
    expect(rig.store.listDossierVersions(id)[0]!.leaf).toBe(first.leaf)
    expect(rig.store.listDossierVersions(id)[1]!.leaf).toBe(second.leaf)
  })

  it('seals, shares with PII enforcement, and revokes to a withdrawn view', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    await runBrief(deps(rig), id, '- Backend engineering')
    await runStudioForge(deps(rig), { dossierId: id })
    const receipt = await sealDossier(deps(rig), id)
    expect(receipt.leaf).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(stateOf(rig, id).stage).toBe('sealed')

    // Share exposing every claim but HIDING contact → recruiter view carries no email.
    const confirmedIds = stateOf(rig, id)
      .claims.filter((c) => c.status === 'confirmed')
      .map((c) => c.id)
    const share = createOrUpdateShare(rig.store, id, {
      exposedClaimIds: confirmedIds,
      showContact: false,
      expiryDays: 30,
    })
    const view = getShareView(rig.store, rig.cfg, share.shareId) as {
      found: boolean
      candidate: { email?: string }
      claims: unknown[]
      seal: unknown
    }
    expect(view.found).toBe(true)
    expect(view.candidate.email).toBeUndefined()
    expect(view.claims.length).toBe(confirmedIds.length)
    expect(view.seal).not.toBeNull()

    // Showing contact exposes it.
    createOrUpdateShare(rig.store, id, {
      exposedClaimIds: confirmedIds,
      showContact: true,
      expiryDays: null,
    })
    const withContact = getShareView(rig.store, rig.cfg, share.shareId) as {
      candidate: { email?: string }
    }
    expect(withContact.candidate.email).toBe('chidinma.eze@example.com')

    // Revoke → withdrawn.
    revokeShare(rig.store, id)
    const revoked = getShareView(rig.store, rig.cfg, share.shareId) as { revoked?: boolean }
    expect(revoked.revoked).toBe(true)
  })

  it('a share ACTUALLY expires once its expiry passes (P11 clock injection)', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    await runBrief(deps(rig), id, '- Backend engineering')
    await runStudioForge(deps(rig), { dossierId: id })
    await sealDossier(deps(rig), id)
    const confirmedIds = stateOf(rig, id)
      .claims.filter((c) => c.status === 'confirmed')
      .map((c) => c.id)
    const share = createOrUpdateShare(rig.store, id, {
      exposedClaimIds: confirmedIds,
      showContact: false,
      expiryDays: 7,
    })
    // Now: fully visible.
    const live = getShareView(rig.store, rig.cfg, share.shareId, Date.now()) as {
      found: boolean
      expired?: boolean
      claims?: unknown[]
    }
    expect(live.found).toBe(true)
    expect(live.expired).toBeUndefined()
    expect((live.claims ?? []).length).toBe(confirmedIds.length)
    // Eight days later (injected clock): the portal is expired — and leaks NO dossier content.
    const later = Date.now() + 8 * 86_400_000
    const expired = getShareView(rig.store, rig.cfg, share.shareId, later) as {
      found: boolean
      expired?: boolean
      claims?: unknown[]
      candidate?: unknown
    }
    expect(expired.found).toBe(true)
    expect(expired.expired).toBe(true)
    expect(expired.claims).toBeUndefined()
    expect(expired.candidate).toBeUndefined()
  })

  it('a share exposing a subset hides the rest (PII_HYGIENE)', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    await runBrief(deps(rig), id, '- Backend engineering')
    await runStudioForge(deps(rig), { dossierId: id })
    await sealDossier(deps(rig), id)
    const claims = stateOf(rig, id).claims.filter((c) => c.status === 'confirmed')
    const only = createOrUpdateShare(rig.store, id, {
      exposedClaimIds: [claims[0]!.id],
      showContact: false,
      expiryDays: null,
    })
    const view = getShareView(rig.store, rig.cfg, only.shareId) as {
      claims: unknown[]
      sentences: Array<{ claimIds: string[] }>
    }
    expect(view.claims.length).toBe(1)
    // No exposed sentence cites a non-exposed claim.
    for (const s of view.sentences)
      expect(s.claimIds.every((cid) => cid === claims[0]!.id)).toBe(true)
  })

  it('freelance share preset exposes only selected work samples', async () => {
    const rig = testRuntime()
    const { id } = await buildConfirmed(rig)
    const claims = stateOf(rig, id).claims.filter((c) => c.status === 'confirmed')
    await runBrief(deps(rig), id, {
      text: 'Client needs a PostgreSQL performance project',
      mode: 'freelance',
      projectClaimIds: [claims[0]!.id],
    })
    await runStudioForge(deps(rig), { dossierId: id })
    const share = createOrUpdateShare(rig.store, id, {
      exposedClaimIds: [claims[0]!.id],
      showContact: false,
      expiryDays: null,
      preset: 'samples',
    })
    const view = getShareView(rig.store, rig.cfg, share.shareId) as {
      preset: string
      sentences: Array<{ claimIds: string[] }>
    }
    expect(view.preset).toBe('samples')
    expect(view.sentences.length).toBeGreaterThan(0)
    expect(view.sentences.every((s) => s.claimIds.every((id) => id === claims[0]!.id))).toBe(true)
  })
})
