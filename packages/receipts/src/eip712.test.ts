import { describe, it, expect } from 'vitest'
import type { Hex } from 'viem'
import { signSeal, recoverSealer, verifySeal, sealerAddress, type DossierSeal } from './eip712'

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex
const REG = '0x1111111111111111111111111111111111111111' as const
const seal: DossierSeal = {
  manifestHash: `0x${'ab'.repeat(32)}` as Hex,
  dossierId: 'DSR-1',
  standardVersion: 'AS-1.1.0',
  issuedAt: 1750000000n,
}

describe('eip712 seal', () => {
  it('signs and recovers the sealer (round-trip)', async () => {
    const sig = await signSeal(KEY, 1952, REG, seal)
    expect((await recoverSealer(1952, REG, seal, sig)).toLowerCase()).toBe(sealerAddress(KEY).toLowerCase())
    expect(await verifySeal(1952, REG, seal, sig, sealerAddress(KEY))).toBe(true)
  })

  it('a tampered manifest hash fails verification', async () => {
    const sig = await signSeal(KEY, 1952, REG, seal)
    const tampered: DossierSeal = { ...seal, manifestHash: `0x${'cd'.repeat(32)}` as Hex }
    expect(await verifySeal(1952, REG, tampered, sig, sealerAddress(KEY))).toBe(false)
  })

  it('is domain-bound: a different chainId fails verification', async () => {
    const sig = await signSeal(KEY, 1952, REG, seal)
    expect(await verifySeal(196, REG, seal, sig, sealerAddress(KEY))).toBe(false)
  })

  it('a wrong expected signer fails', async () => {
    const sig = await signSeal(KEY, 1952, REG, seal)
    expect(await verifySeal(1952, REG, seal, sig, '0x2222222222222222222222222222222222222222')).toBe(false)
  })
})
