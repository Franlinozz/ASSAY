export * from './types'
export * from './checks'

import {
  CLAIM_COVERAGE,
  EVIDENCE_RESOLVES,
  LINK_LIVENESS,
  PLACEHOLDER_TEXT,
  DATE_SANITY,
  XARTIFACT_CONSISTENCY,
  FORMAT_LAW,
  DOCX_INTEGRITY,
  ATS_PARSE_BACK,
  CONTACT_VALIDITY,
  PII_HYGIENE,
  JD_COVERAGE,
  INTERVIEW_INTEGRITY,
  STAR_COMPLETENESS,
  PORTFOLIO_CONTRAST,
} from './checks'
import type { HardCheck } from './types'

// The registry. renderStandardMarkdown() and the grader both read this — published equals shipped.
export const HARD_CHECKS: HardCheck[] = [
  CLAIM_COVERAGE,
  EVIDENCE_RESOLVES,
  LINK_LIVENESS,
  PLACEHOLDER_TEXT,
  DATE_SANITY,
  XARTIFACT_CONSISTENCY,
  FORMAT_LAW,
  DOCX_INTEGRITY,
  ATS_PARSE_BACK,
  CONTACT_VALIDITY,
  PII_HYGIENE,
  JD_COVERAGE,
  INTERVIEW_INTEGRITY,
  STAR_COMPLETENESS,
  PORTFOLIO_CONTRAST,
]

const SPECIAL = new Set([
  'FORMAT_LAW',
  'DOCX_INTEGRITY',
  'ATS_PARSE_BACK',
  'INTERVIEW_INTEGRITY',
  'STAR_COMPLETENESS',
  'PORTFOLIO_CONTRAST',
])

export function checksForArtifact(kind: string): HardCheck[] {
  const wanted = new Set<string>()
  if (kind === 'resume_ats' || kind === 'resume_designed') wanted.add('FORMAT_LAW')
  if (kind === 'resume_docx') wanted.add('DOCX_INTEGRITY')
  if (kind === 'resume_ats') wanted.add('ATS_PARSE_BACK')
  if (kind === 'interview_evaluation') wanted.add('INTERVIEW_INTEGRITY')
  if (kind === 'story_bank') wanted.add('STAR_COMPLETENESS')
  if (kind === 'portfolio_page') wanted.add('PORTFOLIO_CONTRAST')
  return HARD_CHECKS.filter((check) => !SPECIAL.has(check.id) || wanted.has(check.id))
}
