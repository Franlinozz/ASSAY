import { customAlphabet } from 'nanoid'

// Crockford-style base32 (no I, L, O, U) — unambiguous IDs for humans reading receipts.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const nano6 = customAlphabet(ALPHABET, 6)
const nano8 = customAlphabet(ALPHABET, 8)

export const newEvidenceId = (): string => `EV-${nano6()}`
export const newClaimId = (): string => `CLM-${nano6()}`
export const newDossierId = (): string => `DSR-${nano8()}`
