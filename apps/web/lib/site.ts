// Site-wide constants — the public facts every page cites. One source, no drift.
export const SITE = {
  name: 'Assay',
  tagline: 'Proof before polish.',
  url: 'https://assayed.xyz',
  description:
    'An evidence-backed career studio: every claim traced to proof, every document graded against a published standard, machine-verified to survive ATS parsing, and sealed with checkable provenance on X Layer.',
  agentId: '8599',
  registry: '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4',
  chainId: 196,
  network: 'eip155:196',
  explorerRegistry:
    'https://www.oklink.com/x-layer/address/0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4',
  explorerBase: 'https://www.oklink.com/x-layer',
  mcpEndpoint: 'https://api.assayed.xyz/mcp',
  apiBase: 'https://api.assayed.xyz',
  repo: 'https://github.com/Franlinozz/ASSAY',
  studio: 'Xyndicate',
} as const

// The integrity-vs-truth line, verbatim from ASSAY.md (the honesty guarantee).
export const INTEGRITY_LINE =
  'A seal proves the artifact is unchanged — not that a claim is objectively true. We say exactly which tier each claim earned, and we never imply more than that.'

export type Tier = 'attested' | 'documented' | 'linked' | 'sealed'

export const TIERS: Record<Tier, { label: string; explanation: string }> = {
  attested: { label: 'Attested', explanation: 'You said it. Your word, on the record.' },
  documented: { label: 'Documented', explanation: 'A file you supplied supports it.' },
  linked: {
    label: 'Linked',
    explanation: 'A live external source supports it — we fetched the URL to confirm it resolves.',
  },
  sealed: {
    label: 'Sealed',
    explanation: 'The dossier containing it has been integrity-anchored on X Layer.',
  },
}

// Where the server-side API lives. In prod the MCP/studio server runs on the same box.
export const ASY_API = process.env.ASY_API_URL ?? 'http://127.0.0.1:8422'
