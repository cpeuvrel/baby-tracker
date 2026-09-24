import { describe, expect, it } from 'vitest'
import { addDays, formatTime, secondsIntoDay, startOfDay, zonedParts, zonedTime } from './appTime'

describe('appTime (Europe/Paris, whatever the device zone)', () => {
  it('reads wall-clock fields in Paris, winter (UTC+1) and summer (UTC+2)', () => {
    expect(zonedParts(new Date('2026-01-15T23:30:00Z'))).toMatchObject({ year: 2026, month: 1, day: 16, hour: 0, minute: 30 })
    expect(zonedParts(new Date('2026-07-01T22:15:00Z'))).toMatchObject({ month: 7, day: 2, hour: 0, minute: 15, weekday: 4 })
  })

  it('builds the instant of a Paris wall-clock time', () => {
    expect(zonedTime(2026, 1, 15, 9, 0).toISOString()).toBe('2026-01-15T08:00:00.000Z')
    expect(zonedTime(2026, 7, 1, 9, 0).toISOString()).toBe('2026-07-01T07:00:00.000Z')
    expect(zonedTime(2026, 1, 32).toISOString()).toBe('2026-01-31T23:00:00.000Z')
  })

  it('handles daylight saving changes', () => {
    // 2026-03-29: clocks go from 02:00 to 03:00; 2026-10-25: from 03:00 back to 02:00
    expect(zonedTime(2026, 3, 29, 3, 0).toISOString()).toBe('2026-03-29T01:00:00.000Z')
    expect(addDays(zonedTime(2026, 3, 28), 1).toISOString()).toBe('2026-03-28T23:00:00.000Z')
    expect(addDays(zonedTime(2026, 3, 29), 1).getTime() - zonedTime(2026, 3, 29).getTime()).toBe(23 * 3600_000)
    expect(addDays(zonedTime(2026, 10, 25), 1).getTime() - zonedTime(2026, 10, 25).getTime()).toBe(25 * 3600_000)
  })

  it('computes the start of the Paris day and the time into it', () => {
    const lateEvening = new Date('2026-07-01T21:30:00Z') // 23:30 in Paris
    expect(startOfDay(lateEvening).toISOString()).toBe('2026-06-30T22:00:00.000Z')
    expect(secondsIntoDay(lateEvening)).toBe(23.5 * 3600)
  })

  it('formats times in Paris', () => {
    expect(formatTime(new Date('2026-03-05T18:00:00Z'), { hour: '2-digit', minute: '2-digit' }, 'en-GB')).toBe('19:00')
  })
})
