import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/renderers scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/renderers')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
