import { describe, it, expect } from 'vitest'
import { info, packageName } from './index'

describe('@xyndicate/mcp-server scaffold', () => {
  it('exposes its package identity and role', () => {
    expect(packageName).toBe('@xyndicate/mcp-server')
    expect(info.role.length).toBeGreaterThan(10)
  })
})
