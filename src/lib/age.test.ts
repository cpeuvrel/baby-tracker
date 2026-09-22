import { describe, expect, it } from 'vitest'
import { ageInMonths, formatAge } from './age'

describe('formatAge', () => {
  it('formats months, weeks and days since birth', () => {
    // 8 months (240d) + 1 week (7d) + 4 days = 251 days
    const now = new Date('2026-01-01T00:00:00.000Z')
    const birth = new Date(now.getTime() - 251 * 24 * 60 * 60 * 1000).toISOString()

    expect(formatAge(birth, now)).toBe('8m 1w 4d')
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
  it('returns a fractional age using the same 30-day-month approximation as formatAge', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const birth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    expect(ageInMonths(birth, now)).toBeCloseTo(2, 5)
  })

  it('never returns a negative age for a future birth date', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const future = new Date('2026-06-01T00:00:00.000Z').toISOString()

    expect(ageInMonths(future, now)).toBe(0)
  })
})
