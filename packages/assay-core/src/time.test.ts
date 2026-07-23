import { describe, it, expect } from 'vitest'
import { ymInTz, isValidYm, monthsBetween, tenureMonths, isFutureYm, isFutureInstant, parseYm } from './time'

describe('time (user-timezone aware)', () => {
  it('resolves the calendar month in the user timezone across a UTC boundary', () => {
    const instant = '2026-01-31T23:00:00Z'
    expect(ymInTz(instant, 'America/New_York')).toBe('2026-01') // 18:00 EST — still January
    expect(ymInTz(instant, 'Australia/Sydney')).toBe('2026-02') // +11h — already February
    expect(ymInTz(instant, 'UTC')).toBe('2026-01')
  })

  it('handles half-hour offset zones', () => {
    expect(ymInTz('2026-01-31T20:00:00Z', 'Asia/Kolkata')).toBe('2026-02') // +5:30 → Feb 1 01:30
  })

  it('validates YYYY-MM', () => {
    expect(isValidYm('2026-07')).toBe(true)
    expect(isValidYm('2026-13')).toBe(false)
    expect(isValidYm('2026-00')).toBe(false)
    expect(isValidYm('26-7')).toBe(false)
  })

  it('parseYm throws on bad input and parses good input', () => {
    expect(() => parseYm('nope')).toThrow()
    expect(parseYm('2026-07')).toEqual({ year: 2026, month: 7 })
  })

  it('computes months between and inclusive tenure', () => {
    expect(monthsBetween('2018-01', '2019-01')).toBe(12)
    expect(monthsBetween('2020-06', '2020-06')).toBe(0)
    expect(tenureMonths('2018-01', '2018-03')).toBe(3) // Jan, Feb, Mar
    expect(tenureMonths('2020-06', null, '2020-06')).toBe(1) // ongoing, same month
  })

  it('detects future dates', () => {
    expect(isFutureYm('2027-01', '2026-07')).toBe(true)
    expect(isFutureYm('2025-01', '2026-07')).toBe(false)
    expect(isFutureInstant('2999-01-01T00:00:00Z', '2026-07-23T00:00:00Z')).toBe(true)
    expect(isFutureInstant('2000-01-01T00:00:00Z', '2026-07-23T00:00:00Z')).toBe(false)
  })
})
