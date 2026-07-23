import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { PipelineCtx, ToolResult } from './pipelines'
import {
  atsScan,
  claimAudit,
  fitBrief,
  coverLetter,
  storyBank,
  tailorResume,
  createDossierJob,
  jobStatus,
  jobResult,
  verify,
} from './pipelines'
import { priceOf } from './config'
import { toJson } from './util'

// A FRESH McpServer is built per HTTP request (gotcha #1). Tool descriptions are marketplace-grade:
// what you get · price · one concrete example · the proof promise.

export interface McpRuntime {
  pipe: PipelineCtx
  // For a paid tool call, http.ts passes a capture fn so the settled result can be cached against
  // the idempotency key (duplicate replay returns the original, never re-charges/re-runs).
  capture?: (mcpResult: unknown) => void
}

function toMcp(r: ToolResult): {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
} {
  const text = `${r.summary}\n\n${toJson(r.data)}`
  return r.refused
    ? { content: [{ type: 'text', text }], isError: true }
    : { content: [{ type: 'text', text }] }
}

const uploadShape = {
  resumeText: z.string().describe('Résumé as plain text.').optional(),
  resumeB64: z
    .string()
    .describe('Résumé as base64 (PDF or DOCX). Provide `filename` so the type is known.')
    .optional(),
  filename: z
    .string()
    .describe('Original filename, e.g. "resume.pdf" — used to pick the parser.')
    .optional(),
}

const priceTag = (tool: string): string => {
  const p = priceOf(tool)
  return p > 0 ? `Price: ${p} USDT (x402 on X Layer, eip155:196).` : 'Free.'
}

export function buildServer(rt: McpRuntime): McpServer {
  const server = new McpServer({
    name: 'assay',
    version: rt.pipe.cfg.version,
    title: 'Assay — proof before polish',
  })
  const { pipe } = rt

  // Wrap a pipeline fn so its ToolResult becomes an MCP result and (for paid tools) is captured.
  const wrap =
    <A>(fn: (ctx: PipelineCtx, args: A) => ToolResult | Promise<ToolResult>) =>
    async (args: A) => {
      const result = await fn(pipe, args)
      const mcp = toMcp(result)
      rt.capture?.(mcp)
      return mcp
    }

  server.registerTool(
    'asy_ats_scan',
    {
      title: 'ATS scan',
      description: `Scan an existing résumé the way an applicant-tracking system would: re-parse it, flag format-law violations that scramble in ATS software, and (with a job description) report honest must/nice keyword coverage. ${priceTag('asy_ats_scan')} Example: {resumeText:"…", jd:"Senior Backend Engineer…"} → format findings + parse-back + coverage. Proof promise: findings come from Assay's deterministic parser and the published Standard's format law — not a guess.`,
      inputSchema: {
        ...uploadShape,
        jd: z
          .string()
          .describe('Optional job description to score keyword coverage against.')
          .optional(),
      },
    },
    wrap(atsScan),
  )

  server.registerTool(
    'asy_claim_audit',
    {
      title: 'Claim audit',
      description: `Audit résumé bullets or a list of claims for unsupported figures, vagueness, and contradictions, and return a concrete repair brief. ${priceTag('asy_claim_audit')} Example: {claims:["Grew revenue 300%","Led the team"]} → each classified SUPPORTED / UNSUPPORTED_NUMBER / VAGUE. Proof promise: every verdict is deterministic and traces to the source text.`,
      inputSchema: {
        ...uploadShape,
        claims: z
          .array(z.string())
          .describe('A list of claim sentences to audit (alternative to a résumé upload).')
          .optional(),
      },
    },
    wrap(claimAudit),
  )

  server.registerTool(
    'asy_fit_brief',
    {
      title: 'Fit brief',
      description: `Decompose a job description into requirements and map your evidence to each one — strong / partial / confirm / missing — with zero keyword stuffing. ${priceTag('asy_fit_brief')} Example: {jd:"…", claims:["Scaled payments to 12k rps"]} → an honest coverage map. Proof promise: 'missing' is reported honestly; we never invent coverage.`,
      inputSchema: {
        jd: z.string().describe('The job description to decompose.'),
        profile: z
          .record(z.string(), z.unknown())
          .describe('Optional profile JSON (fullName, skills, experiences…).')
          .optional(),
        claims: z.array(z.string()).describe('Evidence claims you stand behind.').optional(),
      },
    },
    wrap(fitBrief),
  )

  const writerInput = {
    dossierId: z.string().describe('An existing sealed dossier to draw evidence from.').optional(),
    profile: z.record(z.string(), z.unknown()).describe('Profile JSON.').optional(),
    claims: z
      .array(z.string())
      .describe('Confirmed evidence claims to cite (required if no dossierId).')
      .optional(),
    evidence: z.string().describe('Supporting evidence text.').optional(),
    jd: z.string().describe('Optional target job description.').optional(),
  }

  server.registerTool(
    'asy_cover_letter',
    {
      title: 'Cover letter',
      description: `Draft a cover letter where every sentence cites a confirmed claim — nothing invented. ${priceTag('asy_cover_letter')} Example: {claims:[…], jd:"…"} → 3–5 cited sentences + a tribunal pass. Proof promise: unsupported sentences become questions, never prose. Needs claims+evidence or a dossierId — it will politely refuse to fabricate.`,
      inputSchema: writerInput,
    },
    wrap(coverLetter),
  )

  server.registerTool(
    'asy_story_bank',
    {
      title: 'Story bank',
      description: `Build 2–4 STAR interview stories, each grounded in a confirmed claim. ${priceTag('asy_story_bank')} Example: {dossierId:"dsr_…"} → cited stories + tribunal grade. Proof promise: every story traces to evidence; thin air is refused.`,
      inputSchema: writerInput,
    },
    wrap(storyBank),
  )

  server.registerTool(
    'asy_tailor_resume',
    {
      title: 'Tailor résumé',
      description: `Rewrite résumé achievement bullets against a target JD, evidence-constrained and format-law clean. ${priceTag('asy_tailor_resume')} Example: {claims:[…], jd:"…"} → tailored bullets + tribunal grade. Proof promise: no bullet renders without a confirmed claim behind it.`,
      inputSchema: writerInput,
    },
    wrap(tailorResume),
  )

  server.registerTool(
    'asy_create_dossier_job',
    {
      title: 'Create dossier (job)',
      description: `Run the full Assay pipeline — extract → grade → seal — and get back a complete Career Dossier: ATS + designed résumé, cover letter, story bank, fit map, portfolio, plus an EIP-712 seal on X Layer. ${priceTag('asy_create_dossier_job')} Returns a jobId immediately (the pipeline is async, gotcha: never blocks a marketplace client). Example: {resumeText:"…", jd:"…"} → {jobId}. Poll asy_job_status, fetch asy_job_result. Proof promise: every artifact is graded against the published Standard and sealed.`,
      inputSchema: {
        ...uploadShape,
        jd: z.string().optional(),
        answers: z.string().describe('Answers to clarifying questions.').optional(),
      },
    },
    async (args) => toMcp(createDossierJob(pipe, args)),
  )

  server.registerTool(
    'asy_job_status',
    {
      title: 'Job status',
      description: `Check a dossier job: queued / running / done / failed. ${priceTag('asy_job_status')} Example: {jobId:"job_…"}.`,
      inputSchema: { jobId: z.string() },
    },
    async (args) => toMcp(jobStatus(pipe, args)),
  )

  server.registerTool(
    'asy_job_result',
    {
      title: 'Job result',
      description: `Fetch a finished dossier's artifacts (signed download links), tribunal summary and seal. ${priceTag('asy_job_result')} (Paid once at create.) Example: {jobId:"job_…"}.`,
      inputSchema: { jobId: z.string() },
    },
    async (args) => toMcp(jobResult(pipe, args)),
  )

  server.registerTool(
    'asy_verify',
    {
      title: 'Verify seal',
      description: `Verify a dossier's on-chain seal: pass a dossierId or a raw leaf → {found, sealStatus, anchoredAt, explorerLink}. ${priceTag('asy_verify')} FREE FOREVER — anyone can check a seal. Proof promise: reads the AssayRegistry directly on X Layer.`,
      inputSchema: { dossierId: z.string().optional(), leaf: z.string().optional() },
    },
    async (args) => toMcp(await verify(pipe, args)),
  )

  return server
}
