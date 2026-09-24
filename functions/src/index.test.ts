import { describe, expect, it } from 'vitest'
import { isWithinCheckWindow } from './index'
import { startOfParisDay } from './parisTime'

describe('isWithinCheckWindow', () => {
  it('matches when now equals the reminder time', () => {
    const now = new Date('2026-03-05T08:00:00Z')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(true)
  })

  it('matches within the interval after the reminder time', () => {
    const now = new Date('2026-03-05T08:10:00Z')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(true)
  })

  it('does not match once the interval has elapsed', () => {
    const now = new Date('2026-03-05T08:15:00Z')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(false)
  })

  it('does not match before the reminder time', () => {
    const now = new Date('2026-03-05T07:59:00Z')
    expect(isWithinCheckWindow('09:00', now, 15)).toBe(false)
  })
})

describe('Paris time on a UTC server', () => {
  it('reads reminder times in Paris time, summer and winter', () => {
    // 09:00 in Paris = 07:00 UTC in summer (UTC+2), 08:00 UTC in winter (UTC+1)
    expect(isWithinCheckWindow('09:00', new Date('2026-07-01T07:05:00Z'), 15)).toBe(true)
    expect(isWithinCheckWindow('09:00', new Date('2026-07-01T09:05:00Z'), 15)).toBe(false)
    expect(isWithinCheckWindow('09:00', new Date('2026-01-15T08:05:00Z'), 15)).toBe(true)
  })

  it('starts the day at Paris midnight', () => {
    expect(startOfParisDay(new Date('2026-07-01T21:30:00Z')).toISOString()).toBe('2026-06-30T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-07-01T23:30:00Z')).toISOString()).toBe('2026-07-01T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-01-15T12:00:00Z')).toISOString()).toBe('2026-01-14T23:00:00.000Z')
  })
})
