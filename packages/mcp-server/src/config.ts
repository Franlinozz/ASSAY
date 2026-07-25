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
  // storage
  dataDir: string
  dbPath: string
  filesDir: string
  signingSecret: string
  fileTtlMs: number
  // limits
  rateLimitPerMin: number
  maxBodyBytes: number
  modelTimeoutMs: number
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
    version: env['ASY_VERSION'] ?? '0.1.0',
    standardVersion: STANDARD_VERSION,
    baseUrl: (env['ASY_BASE_URL'] ?? 'https://api.useassay.xyz').replace(/\/+$/, ''),
    paymentMode,
    network: `eip155:${chainId}`,
    chainId,
    payTo: env['ASY_TREASURY'] ?? '0x0000000000000000000000000000000000000000',
    asset: env['ASY_ASSET'] ?? 'USDT',
    registry: env['ASY_REGISTRY'] ?? '0x0000000000000000000000000000000000000000',
    anchorIntervalMs: num(env['ASY_ANCHOR_INTERVAL_MIN'], 30) * 60_000,
    dataDir,
    dbPath: env['ASY_DB_PATH'] ?? resolve(dataDir, 'assay.db'),
    filesDir: env['ASY_FILES_DIR'] ?? resolve(dataDir, 'files'),
    signingSecret: env['ASY_SIGNING_SECRET'] ?? randomBytes(32).toString('hex'),
    fileTtlMs: num(env['ASY_FILE_TTL_HOURS'], 24) * 3_600_000,
    rateLimitPerMin: num(env['ASY_RATE_LIMIT'], 60),
    maxBodyBytes: num(env['ASY_MAX_BODY_BYTES'], 2 * 1024 * 1024),
    modelTimeoutMs: num(env['ASY_MODEL_TIMEOUT_MS'], 28_000),
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

export const FREE_TOOLS = new Set<string>(['asy_job_status', 'asy_job_result', 'asy_verify'])

export function priceOf(tool: string): number {
  return tool in PRICES ? PRICES[tool as ToolName] : 0
}

export function isPaid(tool: string): boolean {
  return priceOf(tool) > 0
}
