import { describe, it, expect } from 'vitest'
import { DossierSchema, ClaimSchema, EvidenceItemSchema } from '@xyndicate/assay-core'
import type { Dossier } from '@xyndicate/assay-core'
import { ModelRouter, createRouter } from '@xyndicate/providers'
import type { ModelAdapter, RawResult, Role } from '@xyndicate/providers'
import { writeArtifact } from './writer'

function dossier(): Dossier {
  return DossierSchema.parse({
    id: 'DSR-W0000001',
    tz: 'UTC',
    createdAt: '2026-07-01T00:00:00.000Z',
    profile: { fullName: 'Chidinma Eze', timezone: 'UTC', contact: { email: 'c@example.com', links: [] } },
    evidence: [EvidenceItemSchema.parse({ id: 'EV-1', kind: 'document', label: 'r', sourceRef: 'r', contentText: 'Reduced latency by 38%' })],
    claims: [ClaimSchema.parse({ id: 'CLM-1', text: 'Reduced latency by 38%', status: 'confirmed', strength: 'documented', evidenceIds: ['EV-1'], numericFacts: [{ value: 38, unit: '%', context: 'x' }] })],
  })
}

class ScriptedWriter implements ModelAdapter {
  readonly name = 'fake' as const
  calls = 0
  constructor(private readonly payloads: unknown[]) {}
  supports(_role: Role): boolean {
    return true
  }
  async generate(): Promise<RawResult> {
    const payload = this.payloads[Math.min(this.calls, this.payloads.length - 1)]
    this.calls += 1
    return { text: JSON.stringify(payload) }
  }
}

describe('writeArtifact (evidence gate before render)', () => {
  it('fake mode echoes confirmed claims as gate-passing sentences', async () => {
    const r = await writeArtifact({ kind: 'resume_ats', dossier: dossier(), router: createRouter() })
    expect(r.sentences.length).toBeGreaterThan(0)
    expect(r.sentences.every((s) => s.claimIds.includes('CLM-1'))).toBe(true)
    expect(r.questions).toHaveLength(0)
  })

  it('drops a planted unsupported sentence and turns it into a question', async () => {
    const sw = new ScriptedWriter([
      [
        { text: 'Unsupported boast about leadership', claimIds: ['CLM-NOPE'] },
        { text: 'Reduced latency by 38%', claimIds: ['CLM-1'] },
      ],
    ])
    const r = await writeArtifact({ kind: 'resume_ats', dossier: dossier(), router: new ModelRouter([sw]) })
    expect(r.sentences.map((s) => s.text)).not.toContain('Unsupported boast about leadership')
    expect(r.sentences.some((s) => /38%/.test(s.text))).toBe(true)
    expect(r.questions.length).toBeGreaterThan(0)
  })

  it('auto-tightens once: a bad-number first draft is fixed on retry', async () => {
    const sw = new ScriptedWriter([
      [{ text: 'Reduced latency by 99%', claimIds: ['CLM-1'] }], // 99% not in the claim's figures
      [{ text: 'Reduced latency by 38%', claimIds: ['CLM-1'] }], // retry: supported
    ])
    const r = await writeArtifact({ kind: 'resume_ats', dossier: dossier(), router: new ModelRouter([sw]) })
    expect(r.sentences.some((s) => /38%/.test(s.text))).toBe(true)
    expect(r.sentences.some((s) => /99%/.test(s.text))).toBe(false)
    expect(sw.calls).toBe(2)
  })

  it('degrades to no sentences (never invents) with a recorded gap', async () => {
    const r = await writeArtifact({ kind: 'resume_ats', dossier: dossier(), router: new ModelRouter([]) })
    expect(r.sentences).toHaveLength(0)
    expect(r.gaps.length).toBeGreaterThan(0)
  })
})
