import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/assay-core scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/assay-core')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
