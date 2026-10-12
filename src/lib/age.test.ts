// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ageInMonths, DAYS_PER_WHO_MONTH, formatAge } from './age'
import { percentileForValue } from './growthPercentiles'
import { parseDayKey } from './timeline'

describe('formatAge', () => {
  it('formats calendar months, then weeks and days since birth', () => {
    // 21 April → 21 December: 8 months; then 11 days to 1 January.
    expect(formatAge('2025-04-21', new Date('2026-01-01T12:00:00+01:00'))).toBe('8m 1w 4d')
  })

  it('is a whole number of months on a monthly birthday', () => {
    expect(formatAge('2025-01-15', new Date('2026-01-15T09:00:00+01:00'))).toBe('12m')
    expect(formatAge('2025-01-15', new Date('2025-02-15T09:00:00+01:00'))).toBe('1m')
  })

  it("takes a short month's last day as the birthday of a day it does not have", () => {
    // No 31 February: the first month is complete on the 28th.
    expect(formatAge('2025-01-31', new Date('2025-03-01T09:00:00+01:00'))).toBe('1m 1d')
    expect(formatAge('2025-01-31', new Date('2025-02-27T09:00:00+01:00'))).toBe('3w 6d')
  })

  it('counts Paris calendar days, even just after midnight in summer time', () => {
    expect(formatAge('2026-06-01', new Date('2026-06-02T00:30:00+02:00'))).toBe('1d')
    // Across the spring change of time (a 23-hour day).
    expect(formatAge('2026-03-28', new Date('2026-03-30T00:30:00+02:00'))).toBe('2d')
  })

  it('omits zero-value units except when everything is zero', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(formatAge(now.toISOString(), now)).toBe('0d')
  })

  it('never returns a negative age for a future birth date', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const future = new Date('2026-06-01T00:00:00.000Z').toISOString()

    expect(formatAge(future, now)).toBe('0d')
  })

  it('shows only weeks and days before the first month', () => {
    const now = new Date('2026-01-15T00:00:00.000Z')
    const birth = new Date('2026-01-01T00:00:00.000Z').toISOString()

    expect(formatAge(birth, now)).toBe('2w')
  })
})

describe('ageInMonths', () => {
  it('returns a fractional age in WHO months of 365.25 / 12 days', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const birth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    expect(ageInMonths(birth, now)).toBeCloseTo(60 / DAYS_PER_WHO_MONTH, 5)
    expect(ageInMonths(birth, now)).toBeCloseTo(1.97, 2)
  })

  it('is just under 12 months on the first birthday of a 365-day year', () => {
    expect(ageInMonths('2025-01-01', parseDayKey('2026-01-01'))).toBeCloseTo(11.99, 2)
  })

  it('keeps the WHO percentiles up to the second birthday', () => {
    const ageAt730Days = ageInMonths('2025-01-01', parseDayKey('2027-01-01'))
    expect(ageAt730Days).toBeLessThan(24)
    expect(percentileForValue('weight', 'male', ageAt730Days, 12000)).toBeDefined()
  })

  it('never returns a negative age for a future birth date', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const future = new Date('2026-06-01T00:00:00.000Z').toISOString()

    expect(ageInMonths(future, now)).toBe(0)
  })
})
