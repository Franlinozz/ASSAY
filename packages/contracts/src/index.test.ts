import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/contracts scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/contracts')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
