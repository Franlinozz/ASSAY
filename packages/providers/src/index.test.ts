import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/providers scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/providers')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
