import { sha256 } from '@noble/hashes/sha256'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import type { JsonValue } from './json'
import type { Dossier } from './types'
import { STANDARD_VERSION } from './constants'

// Stable canonical JSON: keys sorted recursively, no whitespace, undefined dropped. The same
// dossier always serializes to the same string regardless of key insertion order.
export function canonicalize(value: unknown): string {
  const plain = JSON.parse(JSON.stringify(value ?? null)) as JsonValue
  return JSON.stringify(sortValue(plain))
}

function sortValue(v: JsonValue): JsonValue {
  if (Array.isArray(v)) return v.map(sortValue)
  if (v !== null && typeof v === 'object') {
    const out: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(v).sort()) {
      out[key] = sortValue(v[key] as JsonValue)
    }
    return out
  }
  return v
}

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)))
}

export function keccak256Hex(input: string): string {
  return `0x${bytesToHex(keccak_256(utf8ToBytes(input)))}`
}

// ── Manifest: the deterministic, privacy-preserving summary of a dossier. Contains NO raw
// personal prose — only ids, kinds, evidence tiers, and hex digests. This is what gets hashed
// and (as a salted commitment) anchored on-chain. Guardrail #3. ──

export interface ArtifactHash {
  id: string
  kind: string
  hash: string
}

export interface ClaimDigest {
  id: string
  strength: string
}

export interface Manifest {
  dossierId: string
  profileDigest: string
  artifactHashes: ArtifactHash[]
  claimDigests: ClaimDigest[]
  standardVersion: string
  createdAt: string
}

export function buildManifest(dossier: Dossier): Manifest {
  // Only name + headline feed the digest, and only as a hash — never the raw strings.
  const profileDigest = sha256Hex(
    canonicalize({
      fullName: dossier.profile.fullName,
      headline: dossier.profile.headline ?? null,
    }),
  )

  const artifactHashes: ArtifactHash[] = dossier.artifacts
    .map((a) => ({ id: a.id, kind: a.kind, hash: sha256Hex(canonicalize(a)) }))
    .sort((x, y) => x.id.localeCompare(y.id))

  const claimDigests: ClaimDigest[] = dossier.claims
    .map((c) => ({ id: c.id, strength: c.strength }))
    .sort((x, y) => x.id.localeCompare(y.id))

  return {
    dossierId: dossier.id,
    profileDigest,
    artifactHashes,
    claimDigests,
    standardVersion: STANDARD_VERSION,
    createdAt: dossier.createdAt,
  }
}

export function hashManifest(manifest: Manifest): {
  canonical: string
  sha256: string
  keccak256: string
} {
  const canonical = canonicalize(manifest)
  return { canonical, sha256: sha256Hex(canonical), keccak256: keccak256Hex(canonical) }
}

// Convenience: the keccak256 (Ethereum-style, 0x-prefixed) hash of a dossier's manifest.
export function manifestHash(dossier: Dossier): string {
  return hashManifest(buildManifest(dossier)).keccak256
}
