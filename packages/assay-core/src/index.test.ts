import { describe, it, expect } from 'vitest'
import * as core from './index'

describe('barrel', () => {
  it('re-exports the public surface without collisions', () => {
    for (const name of [
      'assertRenderable',
      'toQuestions',
      'computeStrength',
      'tierExplanation',
      'buildManifest',
      'canonicalize',
      'keccak256Hex',
      'policyGate',
      'buildFactsBlock',
      'ymInTz',
      'DossierSchema',
      'STANDARD_VERSION',
      'newDossierId',
    ]) {
      expect(core).toHaveProperty(name)
    }
  })
})
