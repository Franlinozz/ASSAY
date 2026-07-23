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
    { org: 'Paystack', title: 'Senior Backend Engineer', startYm: '2021-03', endYm: null, location: 'Lagos' },
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
  axes: { voice: 82, specificity: 80, quantification: 84, positioning: 78, tailoring: 76, evidence_honesty: 90 },
  findings: [],
  repairBrief: '',
}

function fakeResponse(req: GenerateRequest): string {
  switch (req.role) {
    case 'extractor':
      return JSON.stringify(FAKE_EXTRACTION)
    case 'decomposer':
      return JSON.stringify(fakeDecompose(req.prompt))
    case 'writer':
      return JSON.stringify([]) // proper fake writer lands in P4
    case 'critic':
      return JSON.stringify(FAKE_CRAFT)
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
    return { ok: true, status: 200, url, title: `Fake page for ${host}`, textExcerpt: `fake content for ${url}` }
  }
}

export function createFakeAdapters(): ModelAdapter[] {
  return [new FakeAdapter()]
}
