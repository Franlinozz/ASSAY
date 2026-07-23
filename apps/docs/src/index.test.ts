import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/docs scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/docs')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
