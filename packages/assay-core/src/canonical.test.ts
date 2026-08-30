import { describe, it, expect } from 'vitest'
import { canonicalize, sha256Hex, keccak256Hex, buildManifest, manifestHash } from './canonical'
import { DossierSchema, ClaimSchema, ArtifactSchema } from './schemas'

describe('canonicalize', () => {
  it('sorts keys so insertion order does not change the string', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
    expect(canonicalize({ a: 2, b: 1 })).toBe('{"a":2,"b":1}')
  })

  it('sorts nested keys and preserves array order', () => {
    expect(canonicalize({ z: { d: 1, c: 2 }, arr: [3, 1, 2] })).toBe(
      '{"arr":[3,1,2],"z":{"c":2,"d":1}}',
    )
  })

  it('drops undefined values', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}')
  })
})

describe('hashing', () => {
  it('sha256Hex is deterministic and 64 lowercase hex chars', () => {
    expect(sha256Hex('assay')).toBe(sha256Hex('assay'))
    expect(sha256Hex('assay')).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'))
  })

  it('keccak256Hex is 0x-prefixed 64 hex chars', () => {
    expect(keccak256Hex('assay')).toMatch(/^0x[0-9a-f]{64}$/)
  })
})

describe('buildManifest (privacy-preserving)', () => {
  const dossier = () =>
    DossierSchema.parse({
      id: 'DSR-TEST0001',
      createdAt: '2026-07-23T00:00:00.000Z',
      tz: 'Europe/London',
      profile: {
        fullName: 'Ada Lovelace',
        headline: 'Staff Analytical Engineer',
        contact: {
          email: 'ada@analytical.example',
          phone: '+44 20 7946 0000',
          links: ['https://ada.example'],
        },
        timezone: 'Europe/London',
      },
      claims: [
        ClaimSchema.parse({
          id: 'CLM-2',
          text: 'Reduced computation time by 40 percent on the Bernoulli routine.',
          strength: 'documented',
          status: 'confirmed',
          evidenceIds: ['EV-1'],
        }),
        ClaimSchema.parse({
          id: 'CLM-1',
          text: 'Authored the first published algorithm.',
          strength: 'linked',
          status: 'confirmed',
          evidenceIds: ['EV-2'],
        }),
      ],
      artifacts: [
        ArtifactSchema.parse({
          id: 'resume_ats',
          kind: 'resume_ats',
          sentences: [{ text: 'Reduced computation time by 40 percent.', claimIds: ['CLM-2'] }],
        }),
      ],
    })

  it('contains ids, kinds, tiers and hex digests, sorted deterministically', () => {
    const m = buildManifest(dossier())
    expect(m.dossierId).toBe('DSR-TEST0001')
    expect(m.profileDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(m.claimDigests).toEqual([
      { id: 'CLM-1', strength: 'linked' },
      { id: 'CLM-2', strength: 'documented' },
    ])
    expect(m.artifactHashes[0]).toMatchObject({ id: 'resume_ats', kind: 'resume_ats' })
    expect(m.artifactHashes[0].hash).toMatch(/^[0-9a-f]{64}$/)
    expect(m.adjudicationReceipts).toEqual([])
    expect(m.standardVersion).toBe('AS-1.1.0')
  })

  it('includes only finalized consensus receipts, never consent prose or evidence URLs', () => {
    const withReceipt = DossierSchema.parse({
      ...dossier(),
      adjudications: [
        {
          claimId: 'CLM-1',
          claimKey: 'DSR-TEST0001.CLM-1.v1',
          claimText: 'Private consent copy of the public claim.',
          criterionId: 'ACTION_AND_OUTCOME',
          standardVersion: 'AS-1.1.0',
          evidenceUrls: ['https://github.com/example/public-proof'],
          network: 'testnet-bradbury',
          chainId: 4221,
          contractAddress: `0x${'11'.repeat(20)}`,
          txHash: `0x${'22'.repeat(32)}`,
          wallet: `0x${'33'.repeat(20)}`,
          status: 'finalized',
          verdict: 'SUPPORTED',
          reasonCode: 'EVIDENCE_SUPPORTS_CLAIM',
          shortReason: 'Public evidence supports it.',
          sourceCount: 1,
          unavailableCount: 0,
          submittedAt: '2026-08-30T00:00:00.000Z',
          updatedAt: '2026-08-30T00:01:00.000Z',
          finalizedAt: '2026-08-30T00:01:00.000Z',
        },
      ],
    })
    const json = JSON.stringify(buildManifest(withReceipt))
    expect(buildManifest(withReceipt).adjudicationReceipts).toHaveLength(1)
    expect(json).toContain(`0x${'22'.repeat(32)}`)
    expect(json).not.toContain('Private consent copy')
    expect(json).not.toContain('github.com/example/public-proof')
    expect(json).not.toContain('Public evidence supports it')
  })

  it('manifest hash is stable regardless of profile key order or claim order', () => {
    const base = dossier()
    const reordered = DossierSchema.parse({
      id: base.id,
      createdAt: base.createdAt,
      tz: base.tz,
      profile: {
        timezone: 'Europe/London',
        headline: 'Staff Analytical Engineer',
        contact: {
          links: ['https://ada.example'],
          phone: '+44 20 7946 0000',
          email: 'ada@analytical.example',
        },
        fullName: 'Ada Lovelace',
      },
      claims: [...base.claims].reverse(),
      artifacts: base.artifacts,
    })
    expect(manifestHash(reordered)).toBe(manifestHash(base))
  })

  it('NON-NEGOTIABLE: the manifest contains NO raw personal prose', () => {
    const json = JSON.stringify(buildManifest(dossier()))
    for (const secret of [
      'Ada',
      'Lovelace',
      'Staff Analytical Engineer',
      'ada@analytical.example',
      'Bernoulli',
      'Reduced computation time',
      'first published algorithm',
    ]) {
      expect(json).not.toContain(secret)
    }
  })
})
