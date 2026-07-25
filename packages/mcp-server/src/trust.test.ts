import { describe, expect, it } from 'vitest'
import { DossierSchema, type Dossier } from '@xyndicate/assay-core'
import { testRuntime } from './testutil'
import { parseVersionRef, versionRef } from './store'
import {
  compareVersions,
  createOrUpdateShare,
  getShareView,
  importCredential,
  setRedactions,
  type StudioDeps,
} from './studio'
import { devPdf } from './jobs'

function dossier(id = 'DSR-TRUST001', version = 1): Dossier {
  return DossierSchema.parse({
    id,
    version,
    tz: 'UTC',
    createdAt: '2026-07-24T00:00:00.000Z',
    profile: {
      fullName: 'Amina Okafor',
      timezone: 'UTC',
      contact: { email: 'amina@private.example', phone: '+234800111222', links: [] },
    },
    evidence: [
      {
        id: 'EV-1',
        kind: 'document',
        label: 'review',
        sourceRef: 'review.txt',
        contentText: 'PRIVATE-CODE shipped revenue by 20%',
      },
    ],
    claims: [
      {
        id: 'CLM-1',
        text: 'PRIVATE-CODE shipped revenue by 20%',
        status: 'confirmed',
        strength: 'documented',
        evidenceIds: ['EV-1'],
        numericFacts: [{ value: 20, unit: '%', context: 'revenue' }],
      },
    ],
    artifacts: [
      {
        id: 'resume_ats',
        kind: 'resume_ats',
        sentences: [{ text: 'PRIVATE-CODE shipped revenue by 20%', claimIds: ['CLM-1'] }],
      },
    ],
    tribunalReports: [
      {
        artifactId: 'resume_ats',
        standardVersion: 'AS-1.1.0',
        passed: true,
        hardFindings: [],
        craftScores: {
          voice: 70,
          specificity: 70,
          quantification: 70,
          positioning: 70,
          tailoring: 70,
          evidence_honesty: 70,
        },
        createdAt: '2026-07-24T00:00:00.000Z',
      },
    ],
  })
}

function studioDeps(rig: ReturnType<typeof testRuntime>): StudioDeps {
  return {
    store: rig.store,
    router: rig.router,
    fetcher: rig.fetcher,
    cfg: rig.cfg,
    toPdf: devPdf,
    realPdf: false,
    sampleContrast: async () => 12,
  }
}

describe('Phase 13 trust layer', () => {
  it('formats a version reference', () => {
    expect(versionRef('DSR-A', 2)).toBe('DSR-A@v2')
  })

  it('parses a version reference', () => {
    expect(parseVersionRef('DSR-A@v12')).toEqual({ dossierId: 'DSR-A', version: 12 })
  })

  it('rejects version zero references', () => {
    expect(parseVersionRef('DSR-A@v0')).toBeUndefined()
  })

  it('stores independently addressable versions', () => {
    const { store } = testRuntime()
    store.saveDossierVersion(dossier())
    store.saveDossierVersion(dossier('DSR-TRUST001', 2))
    expect(store.listDossierVersions('DSR-TRUST001').map((x) => x.version)).toEqual([1, 2])
  })

  it('keeps salts per version', () => {
    const { store } = testRuntime()
    store.saveDossierVersion(dossier(), { salt: 'salt-one' })
    store.saveDossierVersion(dossier('DSR-TRUST001', 2), { salt: 'salt-two' })
    expect(store.getSalt('DSR-TRUST001@v1')).toBe('salt-one')
    expect(store.getSalt('DSR-TRUST001@v2')).toBe('salt-two')
  })

  it('keeps seal status per version', () => {
    const { store } = testRuntime()
    store.saveDossierVersion(dossier(), { sealStatus: 'sealed' })
    store.saveDossierVersion(dossier('DSR-TRUST001', 2), { sealStatus: 'pending' })
    expect(store.getSealStatus('DSR-TRUST001@v1')).toBe('sealed')
    expect(store.getSealStatus('DSR-TRUST001@v2')).toBe('pending')
  })

  it('computes sentence additions and removals', () => {
    const { store } = testRuntime()
    const first = dossier()
    const second = DossierSchema.parse({
      ...dossier('DSR-TRUST001', 2),
      artifacts: [
        {
          id: 'resume_ats',
          kind: 'resume_ats',
          sentences: [{ text: 'A new claim-safe sentence', claimIds: ['CLM-1'] }],
        },
      ],
    })
    store.saveDossierVersion(first)
    store.saveDossierVersion(second)
    const diff = compareVersions(store, first.id, 1, 2) as {
      artifacts: Array<{ added: string[]; removed: string[] }>
    }
    expect(diff.artifacts[0]!.added).toEqual(['A new claim-safe sentence'])
    expect(diff.artifacts[0]!.removed).toEqual(['PRIVATE-CODE shipped revenue by 20%'])
  })

  it('computes tribunal score delta math', () => {
    const { store } = testRuntime()
    const first = dossier()
    const second = DossierSchema.parse({
      ...dossier('DSR-TRUST001', 2),
      tribunalReports: first.tribunalReports.map((report) => ({
        ...report,
        craftScores: Object.fromEntries(
          Object.keys(report.craftScores ?? {}).map((key) => [key, 78]),
        ),
      })),
    })
    store.saveDossierVersion(first)
    store.saveDossierVersion(second)
    const diff = compareVersions(store, first.id, 1, 2) as {
      artifacts: Array<{ scoreDelta: number }>
    }
    expect(diff.artifacts[0]!.scoreDelta).toBe(8)
  })

  it('stores document and text redactions owner-side', () => {
    const { store } = testRuntime()
    store.saveDossier(dossier())
    expect(
      setRedactions(store, 'DSR-TRUST001', 'EV-1', {
        fields: ['email'],
        textRanges: [{ start: 0, end: 12 }],
        regions: [{ page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
      }).ok,
    ).toBe(true)
    expect(store.getEvidenceRedactions('DSR-TRUST001')).toHaveProperty('EV-1')
  })

  it('removes redacted source bytes from public share responses', () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    setRedactions(rig.store, 'DSR-TRUST001', 'EV-1', {
      fields: [],
      textRanges: [{ start: 0, end: 12 }],
      regions: [],
    })
    const share = createOrUpdateShare(rig.store, 'DSR-TRUST001', {
      exposedClaimIds: ['CLM-1'],
      showContact: false,
      expiryDays: null,
    })
    expect(JSON.stringify(getShareView(rig.store, rig.cfg, share.shareId))).not.toContain(
      'PRIVATE-CODE',
    )
  })

  it('never emits redaction records or coordinates in a share response', () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    setRedactions(rig.store, 'DSR-TRUST001', 'EV-1', {
      fields: [],
      textRanges: [],
      regions: [{ page: 1, x: 0.123, y: 0.2, width: 0.3, height: 0.1 }],
    })
    const share = createOrUpdateShare(rig.store, 'DSR-TRUST001', {
      exposedClaimIds: ['CLM-1'],
      showContact: false,
      expiryDays: null,
    })
    const body = JSON.stringify(getShareView(rig.store, rig.cfg, share.shareId))
    expect(body).not.toContain('redactions')
    expect(body).not.toContain('0.123')
  })

  it('field redaction overrides a share contact toggle', () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    setRedactions(rig.store, 'DSR-TRUST001', 'EV-1', {
      fields: ['email'],
      textRanges: [],
      regions: [],
    })
    const share = createOrUpdateShare(rig.store, 'DSR-TRUST001', {
      exposedClaimIds: ['CLM-1'],
      showContact: true,
      expiryDays: null,
    })
    expect(JSON.stringify(getShareView(rig.store, rig.cfg, share.shareId))).not.toContain(
      'amina@private.example',
    )
  })

  it('does not leak a redacted number through numeric-fact metadata', () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    setRedactions(rig.store, 'DSR-TRUST001', 'EV-1', {
      fields: [],
      textRanges: [{ start: 31, end: 34 }],
      regions: [],
    })
    const share = createOrUpdateShare(rig.store, 'DSR-TRUST001', {
      exposedClaimIds: ['CLM-1'],
      showContact: false,
      expiryDays: null,
    })
    const view = getShareView(rig.store, rig.cfg, share.shareId) as {
      claims: Array<{ numericFacts: unknown[] }>
    }
    expect(view.claims[0]!.numericFacts).toHaveLength(0)
  })

  it('does not log views when the creator leaves logging off', () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    const share = createOrUpdateShare(rig.store, 'DSR-TRUST001', {
      exposedClaimIds: ['CLM-1'],
      showContact: false,
      expiryDays: null,
      logViews: false,
    })
    getShareView(rig.store, rig.cfg, share.shareId)
    expect(rig.store.shareViewLog(share.shareId).count).toBe(0)
  })

  it('logs a view only when enabled', () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    const share = createOrUpdateShare(rig.store, 'DSR-TRUST001', {
      exposedClaimIds: ['CLM-1'],
      showContact: false,
      expiryDays: null,
      logViews: true,
    })
    getShareView(rig.store, rig.cfg, share.shareId, Date.parse('2026-07-24T12:47:31Z'))
    expect(rig.store.shareViewLog(share.shareId).count).toBe(1)
  })

  it('coarsens view timestamps to the UTC hour', () => {
    const { store } = testRuntime()
    store.recordShareView('s-private', Date.parse('2026-07-24T12:47:31Z'))
    expect(store.shareViewLog('s-private').recent).toEqual(['2026-07-24T12:00:00.000Z'])
  })

  it('exposes no IP-shaped field in the access-log privacy shape', () => {
    const { store } = testRuntime()
    store.recordShareView('s-private')
    const log = store.shareViewLog('s-private')
    expect(Object.keys(log)).toEqual(['count', 'recent'])
    expect(JSON.stringify(log)).not.toMatch(/ip|address/i)
  })

  it('imports a certificate as documented evidence with issuer and date extraction', async () => {
    const rig = testRuntime()
    rig.store.saveDossier(dossier())
    const result = await importCredential(studioDeps(rig), 'DSR-TRUST001', {
      filename: 'credential.txt',
      text: 'Certificate of Product Leadership\nIssued by X Layer Academy\n2026-06',
    })
    expect(result).toMatchObject({
      evidence: { kind: 'document', strength: 'documented' },
      extracted: { issuer: 'X Layer Academy', issuedYm: '2026-06' },
    })
    expect(String(result['note'])).toContain('out of scope')
  })
})
