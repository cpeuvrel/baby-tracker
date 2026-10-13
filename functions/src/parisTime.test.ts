import { describe, expect, it } from 'vitest'
import { parisDateValue, startOfParisDay, zonedParts } from './parisTime'

describe('startOfParisDay', () => {
  it('starts the day at Paris midnight, summer and winter', () => {
    expect(startOfParisDay(new Date('2026-07-01T21:30:00Z')).toISOString()).toBe('2026-06-30T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-07-01T23:30:00Z')).toISOString()).toBe('2026-07-01T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-01-15T12:00:00Z')).toISOString()).toBe('2026-01-14T23:00:00.000Z')
  })

  it('starts the days when clocks change at the right midnight', () => {
    // 2026-03-29: clocks go forward at 02:00 (UTC+1 → UTC+2); the day began at UTC+1.
    expect(startOfParisDay(new Date('2026-03-29T00:30:00Z')).toISOString()).toBe('2026-03-28T23:00:00.000Z')
    expect(startOfParisDay(new Date('2026-03-29T20:00:00Z')).toISOString()).toBe('2026-03-28T23:00:00.000Z')
    // 2026-10-25: clocks go back at 03:00 (UTC+2 → UTC+1); the day began at UTC+2.
    expect(startOfParisDay(new Date('2026-10-25T00:30:00Z')).toISOString()).toBe('2026-10-24T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-10-25T20:00:00Z')).toISOString()).toBe('2026-10-24T22:00:00.000Z')
    // The next days start at the new offset.
    expect(startOfParisDay(new Date('2026-03-30T12:00:00Z')).toISOString()).toBe('2026-03-29T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-10-26T12:00:00Z')).toISOString()).toBe('2026-10-25T23:00:00.000Z')
  })
})

describe('zonedParts', () => {
  it('reads the repeated 02:30 twice when clocks go back', () => {
    expect(zonedParts(new Date('2026-10-25T00:30:00Z'))).toMatchObject({ day: 25, hour: 2, minute: 30 })
    expect(zonedParts(new Date('2026-10-25T01:30:00Z'))).toMatchObject({ day: 25, hour: 2, minute: 30 })
  })

  it('jumps from 01:59 to 03:00 when clocks go forward', () => {
    expect(zonedParts(new Date('2026-03-29T00:59:00Z'))).toMatchObject({ day: 29, hour: 1, minute: 59 })
    expect(zonedParts(new Date('2026-03-29T01:00:00Z'))).toMatchObject({ day: 29, hour: 3, minute: 0 })
  })
})

describe('parisDateValue', () => {
  it('reads today in Paris', () => {
    expect(parisDateValue(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
    expect(parisDateValue(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
    expect(parisDateValue(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25')
  })
})
