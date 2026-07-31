// Product constants. The Standard version is stamped into every manifest and seal.
export const STANDARD_VERSION = 'AS-1.1.0' as const

export const PRODUCT = {
  name: 'Assay',
  tagline: 'Proof before polish.',
  baseUrl: 'https://assayed.xyz',
  repo: 'https://github.com/Franlinozz/ASSAY',
} as const

// USDT per call on X Layer (eip155:196) — mirrors the AGENTS.md Price Table. Fixed by guardrail #5.
export const TOOL_PRICES = {
  asy_ats_scan: 0.05,
  asy_claim_audit: 0.05,
  asy_fit_brief: 0.1,
  asy_cover_letter: 0.15,
  asy_story_bank: 0.2,
  asy_interview_prep: 0.2,
  asy_tailor_resume: 0.3,
  asy_create_dossier_job: 2.0,
  asy_job_status: 0,
  asy_job_result: 0,
  // Collecting a purchase you already paid for is never a second sale.
  asy_order_result: 0,
  asy_verify: 0,
} as const

// X Layer chain ids. NOTE: verify testnet id at the seal phase — plan says 195, but a
// sibling project hit testnet=1952. Mainnet 196 is confirmed.
export const CHAIN = {
  mainnet: 196,
  testnet: 195,
  caip2: 'eip155:196',
} as const
