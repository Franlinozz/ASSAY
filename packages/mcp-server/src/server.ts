import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
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
import { TOOL_SPECS } from './toolspec'
import { toJson } from './util'

// A FRESH McpServer is built per HTTP request (gotcha #1). Tool metadata (titles, descriptions,
// zod input schemas) lives in toolspec.ts — the same table the public site and docs render from,
// so published schemas can never drift from shipped ones.

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (ctx: PipelineCtx, args: any) => ToolResult | Promise<ToolResult>

const HANDLERS: Record<string, Handler> = {
  asy_ats_scan: atsScan,
  asy_claim_audit: claimAudit,
  asy_fit_brief: fitBrief,
  asy_cover_letter: coverLetter,
  asy_story_bank: storyBank,
  asy_tailor_resume: tailorResume,
  asy_create_dossier_job: createDossierJob,
  asy_job_status: jobStatus,
  asy_job_result: jobResult,
  asy_verify: verify,
}

export function buildServer(rt: McpRuntime): McpServer {
  const server = new McpServer({
    name: 'assay',
    version: rt.pipe.cfg.version,
    title: 'Assay — proof before polish',
  })
  const { pipe } = rt

  for (const spec of TOOL_SPECS) {
    const handler = HANDLERS[spec.name]
    if (!handler) throw new Error(`no handler for tool ${spec.name}`)
    server.registerTool(
      spec.name,
      { title: spec.title, description: spec.description, inputSchema: spec.inputSchema },
      async (args: Record<string, unknown>) => {
        const result = await handler(pipe, args)
        const mcp = toMcp(result)
        rt.capture?.(mcp)
        return mcp
      },
    )
  }

  return server
}
