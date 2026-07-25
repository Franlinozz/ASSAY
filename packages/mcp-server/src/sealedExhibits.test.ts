import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEALED_EXHIBITS, sealedExhibitFor } from './sealedExhibits'

const gallery = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../../apps/web/lib/personas.generated.json'),
    'utf8',
  ),
) as {
  personas: Array<{ dossierId: string; seal: { leaf: string } }>
}

describe('sealed public exhibit index', () => {
  it('matches every generated gallery persona dossier and leaf', () => {
    expect(Object.keys(SEALED_EXHIBITS)).toHaveLength(gallery.personas.length)
    for (const persona of gallery.personas)
      expect(SEALED_EXHIBITS[persona.dossierId]?.leaf).toBe(persona.seal.leaf)
  })

  it('resolves only on the configured mainnet registry', () => {
    expect(
      sealedExhibitFor('DSR-WC0Q7NZ7', 196, '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4')?.leaf,
    ).toBe('0xf838233e08922df8238f2fea3f22d98bbb1a1f32d08b8dd1b6f17d880ae64b29')
    expect(
      sealedExhibitFor('DSR-WC0Q7NZ7', 1952, SEALED_EXHIBITS['DSR-WC0Q7NZ7']!.registry),
    ).toBeUndefined()
    expect(
      sealedExhibitFor('DSR-NOTREAL', 196, SEALED_EXHIBITS['DSR-WC0Q7NZ7']!.registry),
    ).toBeUndefined()
  })
})
