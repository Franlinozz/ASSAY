import type { GapCode } from './gaps'

export type Role = 'extractor' | 'decomposer' | 'writer' | 'critic' | 'utility'
export type ProviderName = 'deepseek' | 'claude' | 'openai' | 'fake'

export interface GenerateRequest {
  role: Role
  prompt: string
  system?: string
  json?: boolean
  maxTokens?: number
  temperature?: number
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface GenerateResult {
  text: string
  json?: unknown
  provider: ProviderName
  role: Role
  usage: Usage
  degraded: boolean
  gap?: GapCode
}

// What an adapter returns before the router applies JSON parsing / cost accounting.
export interface RawResult {
  text: string
  usage?: Partial<Usage>
}

export interface ModelAdapter {
  readonly name: ProviderName
  supports(role: Role): boolean
  generate(req: GenerateRequest, signal: AbortSignal): Promise<RawResult>
}
