import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { STANDARD_VERSION, TOOL_PRICES } from '@xyndicate/assay-core'

// Env-driven server configuration. Secrets come from the environment only (guardrail #4) — never a
// committed file. Sensible dev defaults so the server boots with zero config in fake/dev mode.

export type PaymentMode = 'dev' | 'okx'

export interface OkxFacilitatorConfig {
  apiKey: string
  secretKey: string
  passphrase: string
  baseUrl?: string
}

export interface ServerConfig {
  service: string
  version: string
  standardVersion: string
  baseUrl: string
  agentId?: string
  // payments
  paymentMode: PaymentMode
  network: `eip155:${number}`
  chainId: number
  payTo: string
  asset: string
  okx?: OkxFacilitatorConfig
  // seal / anchor
  registry: string
  sealerKey?: string
  anchorIntervalMs: number
  anchorAlertMs: number
  // storage
  dataDir: string
  dbPath: string
  filesDir: string
  signingSecret: string
  fileTtlMs: number
  // limits
  rateLimitPerMin: number
  maxBodyBytes: number
  /** How long a paid dossier call waits in-band for its background job before handing back a jobId. */
  inlineJobWaitMs: number
  modelTimeoutMs: number
  minFreeDiskBytes: number
}

const num = (v: string | undefined, d: number): number => {
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) ? n : d
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const paymentMode: PaymentMode = env['ASY_PAYMENT_MODE'] === 'okx' ? 'okx' : 'dev'
  const chainId = num(env['ASY_CHAIN_ID'], 196)
  const dataDir = resolve(env['ASY_DATA_DIR'] ?? './data')

  const cfg: ServerConfig = {
    service: 'assay-mcp',
    version: env['ASY_VERSION'] ?? '1.1.0',
    standardVersion: STANDARD_VERSION,
    baseUrl: (env['ASY_BASE_URL'] ?? 'https://api.assayed.xyz').replace(/\/+$/, ''),
    paymentMode,
    network: `eip155:${chainId}`,
    chainId,
    payTo: env['ASY_TREASURY'] ?? '0x0000000000000000000000000000000000000000',
    asset: env['ASY_ASSET'] ?? 'USDT',
    registry: env['ASY_REGISTRY'] ?? '0x0000000000000000000000000000000000000000',
    anchorIntervalMs: num(env['ASY_ANCHOR_INTERVAL_MIN'], 30) * 60_000,
    anchorAlertMs: num(env['ASY_ANCHOR_ALERT_HOURS'], 2) * 3_600_000,
    dataDir,
    dbPath: env['ASY_DB_PATH'] ?? resolve(dataDir, 'assay.db'),
    filesDir: env['ASY_FILES_DIR'] ?? resolve(dataDir, 'files'),
    signingSecret: env['ASY_SIGNING_SECRET'] ?? randomBytes(32).toString('hex'),
    fileTtlMs: num(env['ASY_FILE_TTL_HOURS'], 24) * 3_600_000,
    rateLimitPerMin: num(env['ASY_RATE_LIMIT'], 60),
    inlineJobWaitMs: num(env['ASY_INLINE_JOB_WAIT_MS'], 60_000),
    maxBodyBytes: num(env['ASY_MAX_BODY_BYTES'], 2 * 1024 * 1024),
    modelTimeoutMs: num(env['ASY_MODEL_TIMEOUT_MS'], 28_000),
    minFreeDiskBytes: num(env['ASY_MIN_FREE_DISK_MB'], 256) * 1024 * 1024,
  }

  if (env['ASY_AGENT_ID']) cfg.agentId = env['ASY_AGENT_ID']
  if (env['ASY_SEALER_KEY']) cfg.sealerKey = env['ASY_SEALER_KEY']
  if (
    paymentMode === 'okx' &&
    env['ASY_OKX_API_KEY'] &&
    env['ASY_OKX_SECRET_KEY'] &&
    env['ASY_OKX_PASSPHRASE']
  ) {
    cfg.okx = {
      apiKey: env['ASY_OKX_API_KEY'],
      secretKey: env['ASY_OKX_SECRET_KEY'],
      passphrase: env['ASY_OKX_PASSPHRASE'],
      ...(env['ASY_OKX_BASE_URL'] ? { baseUrl: env['ASY_OKX_BASE_URL'] } : {}),
    }
  }
  return cfg
}

// The fixed price table (guardrail #5). Re-exported from assay-core so the whole server reads one
// source; asy_verify / asy_job_status / asy_job_result are 0 (free).
export const PRICES = TOOL_PRICES
export type ToolName = keyof typeof TOOL_PRICES

export const TOOL_NAMES: ToolName[] = [
  'asy_ats_scan',
  'asy_claim_audit',
  'asy_fit_brief',
  'asy_cover_letter',
  'asy_story_bank',
  'asy_interview_prep',
  'asy_tailor_resume',
  'asy_create_dossier_job',
  'asy_job_status',
  'asy_job_result',
  'asy_verify',
]

// Concrete marketplace resources. Promotion and freelance are offers of the same paid dossier
// tool with a server-enforced variant; the remaining entries map one-to-one to MCP tools.
export const A2MCP_ROUTE_TARGETS: Record<
  string,
  { tool: ToolName; defaults?: Record<string, unknown> }
> = {
  asy_ats_scan: { tool: 'asy_ats_scan' },
  asy_fit_brief: { tool: 'asy_fit_brief' },
  asy_create_dossier_job: { tool: 'asy_create_dossier_job', defaults: { variant: 'job' } },
  asy_interview_prep: { tool: 'asy_interview_prep' },
  asy_promotion_dossier: {
    tool: 'asy_create_dossier_job',
    defaults: { variant: 'promotion' },
  },
  asy_freelancer_proof_pack: {
    tool: 'asy_create_dossier_job',
    defaults: { variant: 'freelance' },
  },
  asy_claim_audit: { tool: 'asy_claim_audit' },
  asy_cover_letter: { tool: 'asy_cover_letter' },
  asy_story_bank: { tool: 'asy_story_bank' },
  asy_tailor_resume: { tool: 'asy_tailor_resume' },
  asy_verify: { tool: 'asy_verify' },
  asy_job_status: { tool: 'asy_job_status' },
  asy_job_result: { tool: 'asy_job_result' },
}

export const FREE_TOOLS = new Set<string>(['asy_job_status', 'asy_job_result', 'asy_verify'])

export function priceOf(tool: string): number {
  return tool in PRICES ? PRICES[tool as ToolName] : 0
}

export function isPaid(tool: string): boolean {
  return priceOf(tool) > 0
}
