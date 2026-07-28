import { describe, it, expect } from 'vitest'
import {
  EvidenceItemSchema,
  ClaimSchema,
  NumericFactSchema,
  ExperienceSchema,
  ContactSchema,
  ArtifactSchema,
  DossierSchema,
  BriefSchema,
} from './schemas'

describe('schemas', () => {
  it('EvidenceItem gets an EV- id and an ISO addedAt by default', () => {
    const ev = EvidenceItemSchema.parse({
      kind: 'document',
      label: 'Old resume',
      sourceRef: 'resume.pdf',
    })
    expect(ev.id).toMatch(/^EV-[0-9A-Z]{6}$/)
    expect(Number.isNaN(new Date(ev.addedAt).getTime())).toBe(false)
  })

  it('Claim defaults to status=extracted, strength=attested, empty arrays', () => {
    const c = ClaimSchema.parse({ text: 'Led migration' })
    expect(c.id).toMatch(/^CLM-[0-9A-Z]{6}$/)
    expect(c.status).toBe('extracted')
    expect(c.strength).toBe('attested')
    expect(c.evidenceIds).toEqual([])
    expect(c.numericFacts).toEqual([])
  })

  it('NumericFact requires value and context; unit is optional', () => {
    const f = NumericFactSchema.parse({ value: 30, unit: '%', context: 'conversion uplift' })
    expect(f.value).toBe(30)
    expect(NumericFactSchema.parse({ value: 5, context: 'team size' }).unit).toBeUndefined()
    expect(() => NumericFactSchema.parse({ value: 5 })).toThrow()
  })

  it('Experience rejects a bad YYYY-MM and accepts a null end', () => {
    expect(() =>
      ExperienceSchema.parse({ org: 'X', title: 'Eng', startYm: '2020-13', endYm: null }),
    ).toThrow()
    const e = ExperienceSchema.parse({ org: 'X', title: 'Eng', startYm: '2020-01', endYm: null })
    expect(e.endYm).toBeNull()
  })

  it('Contact validates the email and defaults links', () => {
    expect(() => ContactSchema.parse({ email: 'not-an-email' })).toThrow()
    expect(ContactSchema.parse({ email: 'a@b.co' }).links).toEqual([])
  })

  it('Artifact rejects an unknown kind and defaults meta', () => {
    expect(() => ArtifactSchema.parse({ id: 'a1', kind: 'nope' })).toThrow()
    expect(ArtifactSchema.parse({ id: 'a1', kind: 'resume_ats' }).meta).toEqual({})
  })

  it('Dossier gets a DSR- id and re-parsing is idempotent', () => {
    const d = DossierSchema.parse({
      profile: { fullName: 'Ada Lovelace', timezone: 'Europe/London' },
      tz: 'Europe/London',
    })
    expect(d.id).toMatch(/^DSR-[0-9A-Z]{8}$/)
    expect(DossierSchema.parse(d)).toEqual(d)
  })

  it('Brief decomposes requirements with kinds and default keywords', () => {
    const b = BriefSchema.parse({
      jdText: 'Need Node',
      decomposed: [{ id: 'R1', text: 'Node.js', kind: 'must' }],
    })
    expect(b.decomposed[0].kind).toBe('must')
    expect(b.decomposed[0].keywords).toEqual([])
  })
})
