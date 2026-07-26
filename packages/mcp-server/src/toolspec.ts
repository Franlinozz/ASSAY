import { z } from 'zod'
import { priceOf } from './config'

// SINGLE SOURCE for tool metadata: server.ts registers the MCP tools from this table, and the
// public site + docs generate their tool references from it (guardrail #2 applied to tools —
// published schemas are the shipped schemas). Descriptions are marketplace-grade: what you get ·
// price · one concrete example · the proof promise.

export const priceTag = (tool: string): string => {
  const p = priceOf(tool)
  return p > 0 ? `Price: ${p} USDT (x402 on X Layer, eip155:196).` : 'Free.'
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

export interface ToolSpec {
  name: string
  title: string
  marketplaceSummary: string
  description: string
  inputSchema: Record<string, z.ZodType>
}

const BACKGROUND_JOB = 'Also runnable as a background job via asy_create_dossier_job.'

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'asy_ats_scan',
    title: 'ATS scan',
    marketplaceSummary:
      'Re-parse a résumé, flag ATS format-law failures, and report JD keyword presence without pretending it proves fit.',
    description: `Scan an existing résumé the way an applicant-tracking system would: re-parse it, flag format-law violations that scramble in ATS software, and (with a job description) report must/nice keyword presence. Keyword presence is not evidence-backed fit; use asy_fit_brief for that stricter map. ${priceTag('asy_ats_scan')} Example: {resumeText:"…", jd:"Senior Backend Engineer…"} → format findings + parse-back + keyword presence. Proof promise: findings come from Assay's deterministic parser and the published Standard's format law — not a guess. ${BACKGROUND_JOB}`,
    inputSchema: {
      ...uploadShape,
      jd: z
        .string()
        .describe('Optional job description to measure keyword presence against.')
        .optional(),
    },
  },
  {
    name: 'asy_claim_audit',
    title: 'Claim audit',
    marketplaceSummary:
      'Classify résumé claims as supported, vague, or carrying an unverified number, then return a repair brief.',
    description: `Audit résumé bullets or a list of claims for unsupported figures, vagueness, and contradictions, and return a concrete repair brief. ${priceTag('asy_claim_audit')} Example: {claims:["Grew revenue 300%","Led the team"]} → each classified SUPPORTED / UNSUPPORTED_NUMBER / VAGUE. Proof promise: every verdict is deterministic and traces to the source text.`,
    inputSchema: {
      ...uploadShape,
      claims: z
        .array(z.string())
        .describe('A list of claim sentences to audit (alternative to a résumé upload).')
        .optional(),
    },
  },
  {
    name: 'asy_fit_brief',
    title: 'Fit brief',
    marketplaceSummary:
      'Map a job description requirement-by-requirement to confirmed evidence: strong, partial, confirm, or missing.',
    description: `Decompose a job description into requirements and map your evidence to each one — strong / partial / confirm / missing — with zero keyword stuffing. ${priceTag('asy_fit_brief')} Example: {jd:"…", claims:["Scaled payments to 12k rps"]} → an honest coverage map. Proof promise: 'missing' is reported honestly; we never invent coverage. ${BACKGROUND_JOB}`,
    inputSchema: {
      jd: z.string().describe('The job description to decompose.'),
      profile: z
        .record(z.string(), z.unknown())
        .describe('Optional profile JSON (fullName, skills, experiences…).')
        .optional(),
      claims: z.array(z.string()).describe('Evidence claims you stand behind.').optional(),
    },
  },
  {
    name: 'asy_cover_letter',
    title: 'Cover letter',
    marketplaceSummary:
      'Draft a target-specific cover letter where every sentence cites a confirmed claim.',
    description: `Draft a cover letter where every sentence cites a confirmed claim — nothing invented. ${priceTag('asy_cover_letter')} Example: {claims:[…], jd:"…"} → 3–5 cited sentences + a tribunal pass. Proof promise: unsupported sentences become questions, never prose. Needs claims+evidence or a dossierId — it will politely refuse to fabricate. ${BACKGROUND_JOB}`,
    inputSchema: writerInput,
  },
  {
    name: 'asy_story_bank',
    title: 'Story bank',
    marketplaceSummary:
      'Build tribunal-graded STAR stories grounded in confirmed claims and evidence.',
    description: `Build 2–4 STAR interview stories, each grounded in a confirmed claim. ${priceTag('asy_story_bank')} Example: {dossierId:"dsr_…"} → cited stories + tribunal grade. Proof promise: every story traces to evidence; thin air is refused. ${BACKGROUND_JOB}`,
    inputSchema: writerInput,
  },
  {
    name: 'asy_interview_prep',
    title: 'Interview prep',
    marketplaceSummary:
      'Generate evidence-grounded questions and check typed answers for STAR structure and ledger contradictions.',
    description: `Generate evidence-grounded behavioral and gap-probing interview questions; optionally evaluate one typed answer for STAR structure, relevance, and contradictions against the confirmed ledger. ${priceTag('asy_interview_prep')} Example: {dossierId:"DSR-…", answer:"I led 12 people…"} → questions + ledger contradiction if the dossier says 8. Proof promise: it evaluates; it never impersonates an interviewer.`,
    inputSchema: {
      ...writerInput,
      answer: z
        .string()
        .describe('Optional typed answer to evaluate against the first generated question.')
        .optional(),
    },
  },
  {
    name: 'asy_tailor_resume',
    title: 'Tailor résumé',
    marketplaceSummary:
      'Tailor résumé achievement bullets to a target role without exceeding the evidence.',
    description: `Rewrite résumé achievement bullets against a target JD, evidence-constrained and format-law clean. ${priceTag('asy_tailor_resume')} Example: {claims:[…], jd:"…"} → tailored bullets + tribunal grade. Proof promise: no bullet renders without a confirmed claim behind it. ${BACKGROUND_JOB}`,
    inputSchema: writerInput,
  },
  {
    name: 'asy_create_dossier_job',
    title: 'Create dossier (job)',
    marketplaceSummary:
      'Run the full job, promotion, or freelance dossier pipeline asynchronously, then grade and seal every artifact.',
    description: `Run the full Assay pipeline — extract → grade → seal — and get back a complete Career Dossier: ATS + designed résumé, cover letter, story bank, fit map, portfolio, plus an EIP-712 seal on X Layer. ${priceTag('asy_create_dossier_job')} Returns a jobId immediately (the pipeline is async, gotcha: never blocks a marketplace client). Example: {resumeText:"…", jd:"…"} → {jobId}. Poll asy_job_status, fetch asy_job_result. Proof promise: every artifact is graded against the published Standard and sealed.`,
    inputSchema: {
      ...uploadShape,
      jd: z.string().optional(),
      answers: z.string().describe('Answers to clarifying questions.').optional(),
      variant: z
        .enum(['job', 'promotion', 'freelance'])
        .describe('Dossier family. Defaults to job.')
        .optional(),
      dateFrom: z.string().describe('Promotion review range start (YYYY-MM).').optional(),
      dateTo: z.string().describe('Promotion review range end (YYYY-MM).').optional(),
    },
  },
  {
    name: 'asy_job_status',
    title: 'Job status',
    marketplaceSummary: 'Poll a background dossier job without another charge.',
    description: `Check a dossier job: queued / running / done / failed. ${priceTag('asy_job_status')} Example: {jobId:"job_…"}.`,
    inputSchema: { jobId: z.string() },
  },
  {
    name: 'asy_job_result',
    title: 'Job result',
    marketplaceSummary:
      'Fetch signed artifact links, tribunal results, portfolio URL, and seal after a paid dossier job.',
    description: `Fetch a finished dossier's artifacts (signed download links), tribunal summary and seal. ${priceTag('asy_job_result')} (Paid once at create.) Example: {jobId:"job_…"}.`,
    inputSchema: { jobId: z.string() },
  },
  {
    name: 'asy_verify',
    title: 'Verify seal',
    marketplaceSummary:
      'Verify a dossier version or commitment leaf against AssayRegistry on X Layer, free forever.',
    description: `Verify a dossier's on-chain seal: pass a dossierId or a raw leaf → {found, sealStatus, anchoredAt, explorerLink}. ${priceTag('asy_verify')} FREE FOREVER — anyone can check a seal. Proof promise: reads the AssayRegistry directly on X Layer.`,
    inputSchema: { dossierId: z.string().optional(), leaf: z.string().optional() },
  },
]

// A serializable view of the specs (for docs/site generation): walks each zod field for its
// type, optionality, and description. No hand-written schema copy anywhere downstream.
export interface ToolArgDoc {
  name: string
  type: string
  required: boolean
  description: string
}

export interface ToolDoc {
  name: string
  title: string
  marketplaceSummary: string
  description: string
  priceUsdt: number
  args: ToolArgDoc[]
}

function zodTypeName(schema: z.ZodType): string {
  let s = schema
  while (s instanceof z.ZodOptional || s instanceof z.ZodDefault) s = s._def.innerType as z.ZodType
  if (s instanceof z.ZodString) return 'string'
  if (s instanceof z.ZodNumber) return 'number'
  if (s instanceof z.ZodBoolean) return 'boolean'
  if (s instanceof z.ZodArray) return `${zodTypeName(s._def.type as z.ZodType)}[]`
  if (s instanceof z.ZodRecord) return 'object'
  return 'unknown'
}

export function toolDocs(): ToolDoc[] {
  return TOOL_SPECS.map((t) => ({
    name: t.name,
    title: t.title,
    marketplaceSummary: t.marketplaceSummary,
    description: t.description,
    priceUsdt: priceOf(t.name),
    args: Object.entries(t.inputSchema).map(([name, schema]) => ({
      name,
      type: zodTypeName(schema),
      required: !(schema instanceof z.ZodOptional),
      description: schema.description ?? '',
    })),
  }))
}
