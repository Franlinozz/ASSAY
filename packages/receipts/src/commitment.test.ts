import { describe, it, expect } from 'vitest'
import type { Hex } from 'viem'
import { DossierSchema } from '@xyndicate/assay-core'
import { newSalt, commitmentLeaf, buildVerifyBundle } from './commitment'

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex
const REG = '0x1111111111111111111111111111111111111111' as const
const dossier = () =>
  DossierSchema.parse({
    id: 'DSR-1',
    tz: 'UTC',
    profile: { fullName: 'Ada Lovelace', timezone: 'UTC' },
  })

describe('commitment', () => {
  it('newSalt is 32 bytes of hex', () => {
    expect(newSalt()).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('commitmentLeaf is deterministic for the same manifestHash + salt', () => {
    const mh = `0x${'ab'.repeat(32)}` as Hex
    const salt = `0x${'cd'.repeat(32)}` as Hex
    expect(commitmentLeaf(mh, salt)).toBe(commitmentLeaf(mh, salt))
    expect(commitmentLeaf(mh, salt)).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('different salts produce different leaves', () => {
    const mh = `0x${'ab'.repeat(32)}` as Hex
    expect(commitmentLeaf(mh, newSalt())).not.toBe(commitmentLeaf(mh, newSalt()))
  })

  it('signed bundle: the salt NEVER appears in the public bundle', async () => {
    const salt = newSalt()
    const bundle = await buildVerifyBundle(dossier(), {
      chainId: 1952,
      registry: REG,
      salt,
      sealerKey: KEY,
    })
    expect(bundle.status).toBe('signed')
    expect(bundle.signer).toBeDefined()
    expect(JSON.stringify(bundle)).not.toContain(salt)
    expect(JSON.stringify(bundle)).not.toContain(salt.slice(2))
    expect(bundle.leaf).toBe(commitmentLeaf(bundle.manifestHash, salt))
  })

  it('is honestly unsigned when no sealer key is present (dev)', async () => {
    const bundle = await buildVerifyBundle(dossier(), {
      chainId: 1952,
      registry: REG,
      salt: newSalt(),
    })
    expect(bundle.status).toBe('unsigned')
    expect(bundle.signature).toBeUndefined()
  })

  it('the bundle contains no personal prose (name)', async () => {
    const bundle = await buildVerifyBundle(dossier(), {
      chainId: 1952,
      registry: REG,
      salt: newSalt(),
      sealerKey: KEY,
    })
    const json = JSON.stringify(bundle)
    expect(json).not.toContain('Ada Lovelace')
    expect(json).not.toContain('Lovelace')
  })
})
