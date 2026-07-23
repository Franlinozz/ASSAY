import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/receipts scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/receipts')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
