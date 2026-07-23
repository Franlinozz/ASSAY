import { randomBytes } from 'node:crypto'

// Short, URL-safe, collision-resistant ids for server-side rows (files, orders, jobs, share slugs).
// Domain ids (dossier/claim/evidence) come from assay-core; these are operational only.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function newId(prefix: string, size = 12): string {
  const bytes = randomBytes(size)
  let out = ''
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return `${prefix}_${out}`
}
