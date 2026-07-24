import type { GenerateRequest, ModelAdapter, Role, RawResult } from '../types'
import type { Fetcher, FetchResult } from '../fetcher'
import { isBlockedIp } from '../fetcher'
import { extractWrapped } from '../prompts'

// FAKES ARE THE DEFAULT (ASY_PROVIDER_MODE=fake). Deterministic, instant, offline — zero spend.

// A grounded fixture persona. Every claim's words appear in SAMPLE_RESUME_TEXT so the extraction
// groundedness post-check keeps them; every number appears too, so none is quantified-without-source.
export const SAMPLE_RESUME_TEXT = `Chidinma Eze
Senior Backend Engineer — Lagos, Nigeria
chidinma.eze@example.com | https://github.com/chidinma

EXPERIENCE
Paystack — Senior Backend Engineer (Mar 2021 – Present), Lagos
- Reduced API p95 latency by 38% by introducing PostgreSQL connection pooling.
- Scaled the payments service to 12000 requests per second during peak sales.

Andela — Backend Engineer (Jun 2018 – Feb 2021)
- Mentored 5 junior engineers and led the migration to TypeScript.

SKILLS
TypeScript, Node.js, PostgreSQL, Redis, Kubernetes`

const FAKE_EXTRACTION = {
  profile: {
    fullName: 'Chidinma Eze',
    headline: 'Senior Backend Engineer',
    contact: { email: 'chidinma.eze@example.com', links: ['https://github.com/chidinma'] },
    skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Kubernetes'],
  },
  experiences: [
    {
      org: 'Paystack',
      title: 'Senior Backend Engineer',
      startYm: '2021-03',
      endYm: null,
      location: 'Lagos',
    },
    { org: 'Andela', title: 'Backend Engineer', startYm: '2018-06', endYm: '2021-02' },
  ],
  claims: [
    {
      text: 'Reduced API p95 latency by 38% by introducing PostgreSQL connection pooling',
      numericFacts: [{ value: 38, unit: '%', context: 'p95 latency reduction' }],
      tags: ['performance', 'postgresql'],
    },
    {
      text: 'Scaled the payments service to 12000 requests per second during peak sales',
      numericFacts: [{ value: 12000, context: 'requests per second' }],
      tags: ['scaling'],
    },
    {
      text: 'Mentored 5 junior engineers and led the migration to TypeScript',
      numericFacts: [{ value: 5, context: 'mentees' }],
      tags: ['leadership', 'typescript'],
    },
  ],
}

// A grounded-but-unsourced-number claim, added only under the e2e repair-demo flag so the Studio
// flow exercises the needs_confirmation path (tokens all appear in SAMPLE_RESUME_TEXT → grounded;
// the number 8 is absent → the claim asks its specific question). Never in unit tests.
function fakeExtraction(): unknown {
  if (process.env['ASY_FAKE_REPAIR_DEMO'] === '1') {
    return {
      ...FAKE_EXTRACTION,
      claims: [
        ...FAKE_EXTRACTION.claims,
        {
          text: 'Mentored 8 engineers through the TypeScript migration',
          numericFacts: [{ value: 8, context: 'engineers mentored' }],
          tags: ['leadership', 'typescript'],
        },
      ],
    }
  }
  return FAKE_EXTRACTION
}

function fakeDecompose(prompt: string): unknown {
  const jd = extractWrapped(prompt, 'job description') ?? ''
  const lines = jd
    .split('\n')
    .map((l) => l.replace(/^[-*•\s]+/, '').trim())
    .filter((l) => l.length > 3)
  const requirements = lines.map((text) => ({
    text,
    kind: /\b(must|required|essential|strong|proven)\b/i.test(text) ? 'must' : 'nice',
    keywords: text
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((w) => w.length >= 4),
  }))
  return { requirements }
}

const FAKE_CRAFT = {
  axes: {
    voice: 82,
    specificity: 80,
    quantification: 84,
    positioning: 78,
    tailoring: 76,
    evidence_honesty: 90,
  },
  findings: [],
  repairBrief: '',
}

// The fake writer echoes each CONFIRMED claim from the facts block as a gate-passing sentence
// (cites the claim id; the number is already in the claim's figures). Deterministic, offline.
function fakeWrite(prompt: string): unknown {
  const lines = [...prompt.matchAll(/- \[(CLM-[0-9A-Z]+) \| \w+\]\s*(.+)/g)]
  return lines.map((m) => ({
    text: m[2]!.replace(/\s*\(figures:.*$/i, '').trim(),
    claimIds: [m[1]!],
  }))
}

// Opt-in (ASY_FAKE_REPAIR_DEMO=1, set only by the e2e stack) deterministic repair story: the FIRST
// cover-letter draft fails craft, the repair passes. Lets the fake pipeline exercise the same
// draft-by-draft repair loop the LIVE run drives on /evaluation — never touches prod or unit tests.
let fakeCoverGrades = 0
const FAKE_CRAFT_FAIL = {
  axes: {
    voice: 58,
    specificity: 70,
    quantification: 80,
    positioning: 66,
    tailoring: 54,
    evidence_honesty: 74,
  },
  findings: [
    {
      axis: 'tailoring',
      detail: 'The letter does not yet answer this specific brief — name the requirement it meets.',
    },
    {
      axis: 'voice',
      detail: 'Opens with a generic line; lead with the strongest proof, not a preamble.',
    },
  ],
  repairBrief:
    'Tighten the cover letter: lead with the 38% latency result, name the payments-scale requirement explicitly, and cut the generic opener.',
}

function fakeCritic(prompt: string): unknown {
  if (process.env['ASY_FAKE_REPAIR_DEMO'] === '1' && /Artifact kind: cover_letter/.test(prompt)) {
    fakeCoverGrades += 1
    if (fakeCoverGrades === 1) return FAKE_CRAFT_FAIL
  }
  return FAKE_CRAFT
}

// Test hook: reset the repair-demo counter so each Studio forge shows its own first-draft fail
// (a prior dossier job in the same process would otherwise have spent it). No-op outside fake mode.
export function resetFakeRepairDemo(): void {
  fakeCoverGrades = 0
}

function fakeResponse(req: GenerateRequest): string {
  switch (req.role) {
    case 'extractor':
      return JSON.stringify(fakeExtraction())
    case 'decomposer':
      return JSON.stringify(fakeDecompose(req.prompt))
    case 'writer':
      return JSON.stringify(fakeWrite(req.prompt))
    case 'critic':
      return JSON.stringify(fakeCritic(req.prompt))
    case 'utility':
      return 'ok'
    default:
      return 'ok'
  }
}

export class FakeAdapter implements ModelAdapter {
  readonly name = 'fake' as const
  supports(_role: Role): boolean {
    return true
  }
  async generate(req: GenerateRequest, _signal: AbortSignal): Promise<RawResult> {
    return { text: fakeResponse(req), usage: { inputTokens: 12, outputTokens: 24, costUsd: 0 } }
  }
}

// Deterministic offline fetcher. Honours scheme + private-IP blocks for realism; treats URLs
// containing "dead" or "404" as not-live, everything else public+https as live.
export class FakeFetcher implements Fetcher {
  async fetch(url: string): Promise<FetchResult> {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return { ok: false, status: 0, url, gap: 'FETCH_BLOCKED', blockedReason: 'malformed url' }
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, status: 0, url, gap: 'FETCH_BLOCKED', blockedReason: 'scheme' }
    }
    const host = u.hostname.replace(/^\[|\]$/g, '')
    if ((/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) && isBlockedIp(host)) {
      return { ok: false, status: 0, url, gap: 'FETCH_BLOCKED', blockedReason: 'private ip' }
    }
    if (/dead|404/i.test(url)) {
      return { ok: false, status: 404, url, gap: 'FETCH_DEAD' }
    }
    return {
      ok: true,
      status: 200,
      url,
      title: `Fake page for ${host}`,
      textExcerpt: `fake content for ${url}`,
    }
  }
}

export function createFakeAdapters(): ModelAdapter[] {
  return [new FakeAdapter()]
}
