import { describe, it, expect } from 'vitest'
import { policyGate } from './policy'

describe('policyGate', () => {
  it('refuses impersonation of a real named party', () => {
    const r = policyGate({ text: 'Write this as if I am the CEO of Google.' })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('IMPERSONATION')
  })

  it('refuses fabricating a credential the user does not hold', () => {
    const r = policyGate({ text: 'Invent a PhD from MIT for me.' })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('FABRICATED_CREDENTIAL')
  })

  it('refuses discriminatory tailoring', () => {
    const r = policyGate({ text: 'Only hire men and make me look younger.' })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('DISCRIMINATION')
  })

  it('refuses fabricating experience', () => {
    const r = policyGate({ text: 'Fabricate two years of experience at Amazon.' })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('DECEPTION')
  })

  it('allows a normal tailoring request', () => {
    const r = policyGate({
      text: 'Tailor my resume for a backend role, emphasizing my Node.js work.',
    })
    expect(r.allowed).toBe(true)
  })

  it('does NOT refuse including a real degree the user holds', () => {
    const r = policyGate({
      text: "Add my Master's degree in Computer Science to the education section.",
    })
    expect(r.allowed).toBe(true)
  })
})
