import { describe, it, expect } from 'vitest'
import { sanitizeGap, logRaw, setRawSink } from './gaps'

describe('gap sanitizer (guardrail #9)', () => {
  it('returns a stable code + human sentence, never a raw error', () => {
    const g = sanitizeGap('PROVIDER_QUOTA')
    expect(g.code).toBe('PROVIDER_QUOTA')
    expect(g.message).not.toMatch(/stack|exception|api[_-]?key|429/i)
    expect(g.message.length).toBeGreaterThan(10)
  })

  it('sends raw errors only to the log sink, never into the sanitized gap', () => {
    const lines: string[] = []
    setRawSink((l) => lines.push(l))
    const secret = 'RAW ERROR sk-secret-123 at line 42'
    logRaw('PROVIDER_ERROR', new Error(secret))
    const g = sanitizeGap('PROVIDER_ERROR')
    expect(lines.join('\n')).toContain('sk-secret-123') // raw goes to server logs
    expect(g.message).not.toContain('sk-secret-123') // sanitized surface never leaks it
    setRawSink((l) => console.error(l))
  })
})
