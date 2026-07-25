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
]
