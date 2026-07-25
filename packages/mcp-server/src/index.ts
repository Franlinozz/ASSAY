// @xyndicate/mcp-server — the sellable ASP: 11-tool MCP server, x402 payment gate, async dossier
// jobs, better-sqlite3 store, and the on-chain anchor worker.

export const packageName = '@xyndicate/mcp-server' as const

export { loadConfig, PRICES, TOOL_NAMES, FREE_TOOLS, priceOf, isPaid } from './config'
export type { ServerConfig, PaymentMode, ToolName } from './config'
export { Store } from './store'
export type {
  JobStatus,
  OrderStatus,
  SealStatus,
  FileRow,
  OrderRow,
  JobRow,
  SealRow,
} from './store'
export { createGate, DevGate, OkxGate, readPaymentSig } from './gate'
export type { PaymentGate, GateDecision, GateOpts } from './gate'
export { buildServer } from './server'
export type { McpRuntime } from './server'
export { buildApp } from './http'
export type { AppRuntime } from './http'
export { JobRunner, runDossierPipeline, devPdf } from './jobs'
export type { JobDeps } from './jobs'
export { AnchorWorker } from './anchor'
export type { DrainResult } from './anchor'
export { SEALED_EXHIBITS, sealedExhibitFor } from './sealedExhibits'
export type { SealedExhibit } from './sealedExhibits'
export {
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
  analyzeAtsFormat,
  signedLink,
  makeCtx,
} from './pipelines'
export type { PipelineCtx, ToolResult } from './pipelines'
export { signFileToken, verifyFileToken, bigintReplacer, toJson, TokenBucket } from './util'
export { main } from './main'
