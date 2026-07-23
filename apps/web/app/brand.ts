// Single source of truth for brand copy — imported by layout, page, and the smoke test
// (CSS-free so it can be unit-tested without a DOM or a bundler).
export const BRAND = {
  name: 'Assay',
  tagline: 'Proof before polish.',
  title: 'Assay — Proof before polish.',
  description:
    'An evidence-backed career studio: every claim traced to proof, every document graded against a published standard, machine-verified to survive ATS parsing, and sealed with checkable provenance on X Layer.',
} as const
