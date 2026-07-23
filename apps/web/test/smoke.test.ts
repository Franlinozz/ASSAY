import { describe, it, expect } from 'vitest'
import { BRAND } from '../app/brand'

describe('@xyndicate/web scaffold', () => {
  it('carries the tagline and a substantive pitch', () => {
    expect(BRAND.tagline).toBe('Proof before polish.')
    expect(BRAND.title).toContain('Assay')
    expect(BRAND.description.length).toBeGreaterThan(40)
  })
})
