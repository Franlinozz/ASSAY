import type { GenerateRequest, ModelAdapter, ProviderName, RawResult, Role } from '../types'

// Live adapters call each provider's REST endpoint directly with fetch — no SDK dependency, so no
// SDK version drift. Exercised only when ASY_PROVIDER_MODE=live; never touched by the test gate.

function cost(inTok: number, outTok: number, priceInPerM: number, priceOutPerM: number): number {
  return (inTok / 1_000_000) * priceInPerM + (outTok / 1_000_000) * priceOutPerM
}

async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 500)
  } catch {
    return ''
  }
}

// OpenAI-compatible chat completions (covers OpenAI and DeepSeek).
class OpenAICompatAdapter implements ModelAdapter {
  constructor(
    readonly name: ProviderName,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly priceIn: number,
    private readonly priceOut: number,
  ) {}

  supports(_role: Role): boolean {
    return true
  }

  async generate(req: GenerateRequest, signal: AbortSignal): Promise<RawResult> {
    const messages = [
      ...(req.system ? [{ role: 'system', content: req.system }] : []),
      { role: 'user', content: req.prompt },
    ]
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.2,
    }
    if (req.json) body['response_format'] = { type: 'json_object' }

    const r = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`${this.name} ${r.status}: ${await safeText(r)}`)
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    const inTok = data.usage?.prompt_tokens ?? 0
    const outTok = data.usage?.completion_tokens ?? 0
    return { text, usage: { inputTokens: inTok, outputTokens: outTok, costUsd: cost(inTok, outTok, this.priceIn, this.priceOut) } }
  }
}

class ClaudeAdapter implements ModelAdapter {
  readonly name = 'claude' as const
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly priceIn = 3,
    private readonly priceOut = 15,
  ) {}

  supports(_role: Role): boolean {
    return true
  }

  async generate(req: GenerateRequest, signal: AbortSignal): Promise<RawResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.2,
      messages: [{ role: 'user', content: req.prompt }],
    }
    if (req.system) body['system'] = req.system

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`claude ${r.status}: ${await safeText(r)}`)
    const data = (await r.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
    const inTok = data.usage?.input_tokens ?? 0
    const outTok = data.usage?.output_tokens ?? 0
    return { text, usage: { inputTokens: inTok, outputTokens: outTok, costUsd: cost(inTok, outTok, this.priceIn, this.priceOut) } }
  }
}

function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v : undefined
}

// Only providers with a key present become available (this drives "which adapters are live").
export function createLiveAdapters(): ModelAdapter[] {
  const adapters: ModelAdapter[] = []
  const deepseekKey = env('DEEPSEEK_API_KEY')
  if (deepseekKey) {
    adapters.push(
      new OpenAICompatAdapter('deepseek', 'https://api.deepseek.com/v1', deepseekKey, env('ASY_DEEPSEEK_MODEL') ?? 'deepseek-chat', 0.27, 1.1),
    )
  }
  const anthropicKey = env('ANTHROPIC_API_KEY')
  if (anthropicKey) {
    adapters.push(new ClaudeAdapter(anthropicKey, env('ASY_CLAUDE_MODEL') ?? 'claude-sonnet-5'))
  }
  const openaiKey = env('OPENAI_API_KEY')
  if (openaiKey) {
    adapters.push(
      new OpenAICompatAdapter('openai', 'https://api.openai.com/v1', openaiKey, env('ASY_OPENAI_MODEL') ?? 'gpt-4o-mini', 0.15, 0.6),
    )
  }
  return adapters
}
