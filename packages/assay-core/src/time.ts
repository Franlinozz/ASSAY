// All user-facing time is computed in the USER'S timezone (gotcha #12). Implemented with the
// native Intl API — zero dependencies, deterministic, and IANA-tz aware.

export function nowIso(): string {
  return new Date().toISOString()
}

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidYm(ym: string): boolean {
  return YM_RE.test(ym)
}

export function parseYm(ym: string): { year: number; month: number } {
  if (!isValidYm(ym)) throw new Error(`invalid YYYY-MM: ${ym}`)
  const [y, m] = ym.split('-')
  return { year: Number(y), month: Number(m) }
}

// The calendar month (YYYY-MM) that a given instant falls in, in the target timezone.
// e.g. 2026-01-31T23:00:00Z is "2026-01" in America/New_York but "2026-02" in Australia/Sydney.
export function ymInTz(iso: string, timeZone: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`invalid ISO datetime: ${iso}`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  return `${year}-${month}`
}

export function formatInTz(
  iso: string,
  timeZone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`invalid ISO datetime: ${iso}`)
  const base: Intl.DateTimeFormatOptions = opts ?? { dateStyle: 'medium', timeStyle: 'short' }
  return new Intl.DateTimeFormat('en-US', { timeZone, ...base }).format(d)
}

// Signed number of whole months from startYm to endYm (endYm - startYm).
export function monthsBetween(startYm: string, endYm: string): number {
  const a = parseYm(startYm)
  const b = parseYm(endYm)
  return (b.year - a.year) * 12 + (b.month - a.month)
}

// Inclusive tenure length in months. A null end means "to refYm" (default: current UTC month).
export function tenureMonths(startYm: string, endYm: string | null, refYm?: string): number {
  const end = endYm ?? refYm ?? ymInTz(nowIso(), 'UTC')
  return monthsBetween(startYm, end) + 1
}

export function isFutureYm(ym: string, refYm: string): boolean {
  return monthsBetween(refYm, ym) > 0
}

export function isFutureInstant(iso: string, nowIsoStr?: string): boolean {
  return new Date(iso).getTime() > new Date(nowIsoStr ?? nowIso()).getTime()
}
