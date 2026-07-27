import { describe, it, expect } from 'vitest'
import {
  looksLikeDocument,
  normalizeArgs,
  preflight,
  resolveServiceSlug,
  resolveToolName,
  serviceSchema,
} from './intake'

const RESUME =
  'Jane Doe — jane@example.com\nEXPERIENCE\nAcme (2022–2025), Product Manager. Shipped billing v2 to 40k users.\nSKILLS\nSQL, Python'
const JD = 'Senior Product Manager — own the billing roadmap, 5+ years of B2B SaaS.'

describe('intake — name resolution', () => {
  it('resolves canonical, short, title and marketplace names for a tool', () => {
    expect(resolveToolName('asy_ats_scan')).toBe('asy_ats_scan')
    expect(resolveToolName('ats_scan')).toBe('asy_ats_scan')
    expect(resolveToolName('ATS scan')).toBe('asy_ats_scan')
    expect(resolveToolName('ATS Resume Scan')).toBe('asy_ats_scan')
    expect(resolveToolName('Career Dossier')).toBe('asy_create_dossier_job')
    expect(resolveToolName('not a service')).toBeUndefined()
  })

  it('resolves service slugs by dash, underscore and marketplace label', () => {
    expect(resolveServiceSlug('asy_fit_brief')).toBe('asy_fit_brief')
    expect(resolveServiceSlug('fit-brief')).toBe('asy_fit_brief')
    expect(resolveServiceSlug('Job Fit Brief')).toBe('asy_fit_brief')
    // The three dossier entry points keep their own slugs so the variant default survives.
    expect(resolveServiceSlug('Promotion Dossier')).toBe('asy_promotion_dossier')
    expect(resolveServiceSlug('nope')).toBeUndefined()
  })
})

describe('intake — argument tolerance', () => {
  it('maps the obvious synonyms onto the published schema', () => {
    const args = normalizeArgs('asy_ats_scan', { resume: RESUME, jobDescription: JD })
    expect(args['resumeText']).toBe(RESUME)
    expect(args['jd']).toBe(JD)
  })

  it('never lets an alias overwrite a canonical key the caller supplied', () => {
    const args = normalizeArgs('asy_fit_brief', { jd: JD, jobDescription: 'something else' })
    expect(args['jd']).toBe(JD)
  })

  it('coerces a single claims string into the array the schema declares', () => {
    const args = normalizeArgs('asy_cover_letter', {
      claims: '- Shipped billing v2\n- Cut latency 900ms → 320ms',
    })
    expect(args['claims']).toEqual(['Shipped billing v2', 'Cut latency 900ms → 320ms'])
  })

  it('unwraps a generic container and keeps outer keys authoritative', () => {
    const args = normalizeArgs('asy_fit_brief', { input: { jobDescription: JD }, claims: ['a'] })
    expect(args['jd']).toBe(JD)
    expect(args['claims']).toEqual(['a'])
  })

  it('accepts a document-shaped free-text field but not a chat message', () => {
    expect(looksLikeDocument(RESUME)).toBe(true)
    expect(looksLikeDocument('can you scan my resume?')).toBe(false)
    expect(normalizeArgs('asy_ats_scan', { text: RESUME })['resumeText']).toBe(RESUME)
    expect(normalizeArgs('asy_ats_scan', { query: 'scan my resume please' })['resumeText']).toBe(
      undefined,
    )
  })

  it('accepts a bare string body and routes it by shape', () => {
    expect(normalizeArgs('asy_ats_scan', RESUME)['resumeText']).toBe(RESUME)
    expect(normalizeArgs('asy_verify', 'DSR-WC0Q7NZ7')['dossierId']).toBe('DSR-WC0Q7NZ7')
    expect(normalizeArgs('asy_job_status', 'job_abc123')['jobId']).toBe('job_abc123')
  })

  it('normalizes variant wording and strips a data: prefix from base64 uploads', () => {
    expect(normalizeArgs('asy_create_dossier_job', { type: 'Promotion review' })['variant']).toBe(
      'promotion',
    )
    expect(
      normalizeArgs('asy_create_dossier_job', { resumeB64: 'data:application/pdf;base64,QUJD' })[
        'resumeB64'
      ],
    ).toBe('QUJD')
  })

  it('maps job/id onto jobId for a status poll without touching the fit brief', () => {
    expect(normalizeArgs('asy_job_status', { id: 'job_x' })['jobId']).toBe('job_x')
    expect(normalizeArgs('asy_fit_brief', { job: JD })['jd']).toBe(JD)
  })
})

describe('intake — preflight', () => {
  it('names exactly what is missing per tool', () => {
    expect(preflight('asy_ats_scan', {})).toMatchObject({ ok: false, code: 'RESUME_REQUIRED' })
    expect(preflight('asy_fit_brief', {})).toMatchObject({ ok: false, code: 'JD_REQUIRED' })
    expect(preflight('asy_cover_letter', {})).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REQUIRED',
    })
    expect(preflight('asy_create_dossier_job', { variant: 'job' })).toMatchObject({
      ok: false,
      code: 'RESUME_REQUIRED',
    })
    expect(preflight('asy_job_result', {})).toMatchObject({ ok: false, code: 'JOB_ID_REQUIRED' })
    expect(preflight('asy_verify', {})).toMatchObject({
      ok: false,
      code: 'DOSSIER_OR_LEAF_REQUIRED',
    })
  })

  it('passes a properly specified request for every tool', () => {
    expect(preflight('asy_ats_scan', { resumeText: RESUME }).ok).toBe(true)
    expect(preflight('asy_claim_audit', { claims: ['Grew revenue 300%'] }).ok).toBe(true)
    expect(preflight('asy_fit_brief', { jd: JD }).ok).toBe(true)
    expect(preflight('asy_story_bank', { dossierId: 'DSR-1' }).ok).toBe(true)
    expect(preflight('asy_interview_prep', { claims: ['Led a team of 8'] }).ok).toBe(true)
    expect(preflight('asy_create_dossier_job', { resumeText: RESUME }).ok).toBe(true)
    expect(preflight('asy_job_status', { jobId: 'job_1' }).ok).toBe(true)
    expect(preflight('asy_verify', { dossierId: 'DSR-1' }).ok).toBe(true)
  })

  it('rejects a base64 upload that cannot decode to a document', () => {
    expect(preflight('asy_create_dossier_job', { resumeB64: 'not base64!!' }).ok).toBe(false)
    expect(preflight('asy_create_dossier_job', { resumeB64: 'QUJD' }).ok).toBe(false)
    expect(preflight('asy_create_dossier_job', { resumeB64: 'QQ'.repeat(200) }).ok).toBe(true)
  })

  it('every rejection carries a runnable example that itself passes preflight', () => {
    for (const tool of [
      'asy_ats_scan',
      'asy_claim_audit',
      'asy_fit_brief',
      'asy_cover_letter',
      'asy_story_bank',
      'asy_tailor_resume',
      'asy_interview_prep',
      'asy_create_dossier_job',
      'asy_job_status',
      'asy_job_result',
      'asy_verify',
    ]) {
      const problem = preflight(tool, {})
      expect(problem.ok, tool).toBe(false)
      if (problem.ok) continue
      expect(problem.accepts.length, tool).toBeGreaterThan(0)
      expect(preflight(tool, problem.example).ok, `${tool} example`).toBe(true)
    }
  })
})

describe('intake — published service schema', () => {
  it('describes a service with its price, arguments and a working example', () => {
    const schema = serviceSchema('asy_ats_scan', 'https://api.assayed.xyz') as {
      tool: string
      priceUsdt: number
      arguments: Array<{ name: string }>
      example: Record<string, unknown>
    }
    expect(schema.tool).toBe('asy_ats_scan')
    expect(schema.priceUsdt).toBe(0.05)
    expect(schema.arguments.map((a) => a.name)).toContain('resumeText')
    expect(preflight('asy_ats_scan', schema.example).ok).toBe(true)
    expect(serviceSchema('nope', 'https://api.assayed.xyz')).toBeUndefined()
  })
})
