import { describe, expect, it } from 'vitest'
import type { FeedingEntry, SleepEntry } from '../types/models'
import {
  computeDelta,
  computeFeedingStats,
  computeSleepStats,
  DEFAULT_NIGHTTIME_HOURS,
  isDuringNight,
  nightClocks,
} from './aggregations'

function sleepEntry(overrides: Partial<SleepEntry>): SleepEntry {
  return {
    id: 's1',
    startedAt: '2026-03-05T10:00:00.000Z',
    endedAt: '2026-03-05T11:00:00.000Z',
    durationSeconds: 3600,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T10:00:00.000Z',
    ...overrides,
  }
}

function feedingEntry(overrides: Partial<FeedingEntry>): FeedingEntry {
  return {
    id: 'f1',
    type: 'bottle',
    occurredAt: '2026-03-05T10:00:00.000Z',
    volumeMl: 120,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T10:00:00.000Z',
    ...overrides,
  }
}

describe('computeSleepStats', () => {
  it('sums durations and averages over the given day count', () => {
    const entries = [
      sleepEntry({ durationSeconds: 3600, startedAt: '2026-03-05T14:00:00.000Z' }),
      sleepEntry({ durationSeconds: 1800, startedAt: '2026-03-06T14:00:00.000Z' }),
    ]

    const stats = computeSleepStats(entries, 2)

    expect(stats.totalSeconds).toBe(5400)
    expect(stats.averageSecondsPerDay).toBe(2700)
  })

  it('treats an in-progress entry (null duration) as zero', () => {
    const stats = computeSleepStats([sleepEntry({ durationSeconds: null })], 1)

    expect(stats.totalSeconds).toBe(0)
  })

  it('counts entries starting at night or before the morning cutoff as night wakings', () => {
    const entries = [
      sleepEntry({ startedAt: '2026-03-05T21:00:00.000Z' }), // 21:00 -> night
      sleepEntry({ startedAt: '2026-03-05T02:00:00.000Z' }), // 02:00 -> night
      sleepEntry({ startedAt: '2026-03-05T14:00:00.000Z' }), // 14:00 -> day nap
    ]

    expect(computeSleepStats(entries, 1).nightWakings).toBe(2)
  })

  it('returns a zero average when there are no days in range', () => {
    expect(computeSleepStats([], 0).averageSecondsPerDay).toBe(0)
  })
})

describe('computeFeedingStats', () => {
  it('separates bottle and solid counts and sums bottle volume', () => {
    const entries = [
      feedingEntry({ type: 'bottle', volumeMl: 120 }),
      feedingEntry({ type: 'bottle', volumeMl: 90 }),
      feedingEntry({ type: 'solid', volumeMl: null }),
    ]

    const stats = computeFeedingStats(entries)

    expect(stats.bottleCount).toBe(2)
    expect(stats.solidCount).toBe(1)
    expect(stats.totalVolumeMl).toBe(210)
    expect(stats.averageVolumeMl).toBe(105)
  })

  it('returns a null average volume when no bottle recorded a volume', () => {
    const stats = computeFeedingStats([feedingEntry({ type: 'bottle', volumeMl: null })])

    expect(stats.averageVolumeMl).toBeNull()
  })
})

describe('isDuringNight', () => {
  // Paris is UTC+1 in March.
  it('uses the default 20:00 – 08:00 night, wrapping past midnight', () => {
    expect(isDuringNight(new Date('2026-03-05T21:00:00.000Z'), DEFAULT_NIGHTTIME_HOURS)).toBe(true) // 22:00
    expect(isDuringNight(new Date('2026-03-05T02:00:00.000Z'), DEFAULT_NIGHTTIME_HOURS)).toBe(true) // 03:00
    expect(isDuringNight(new Date('2026-03-05T13:00:00.000Z'), DEFAULT_NIGHTTIME_HOURS)).toBe(false) // 14:00
    expect(isDuringNight(new Date('2026-03-05T07:00:00.000Z'), DEFAULT_NIGHTTIME_HOURS)).toBe(false) // 08:00, the end
  })

  it('uses a custom nighttime range, wrapping or not', () => {
    const at18 = new Date('2026-03-05T17:00:00.000Z')
    expect(isDuringNight(at18, { start: '18:00', end: '08:00' })).toBe(true)
    expect(isDuringNight(new Date('2026-03-04T23:30:00.000Z'), { start: '00:00', end: '06:00' })).toBe(true) // 00:30
    expect(isDuringNight(new Date('2026-03-05T22:00:00.000Z'), { start: '00:00', end: '06:00' })).toBe(false) // 23:00
  })

  it('has no night when it starts and ends at the same time', () => {
    expect(isDuringNight(new Date('2026-03-05T19:00:00.000Z'), { start: '20:00', end: '20:00' })).toBe(false)
  })
})

describe('nightClocks', () => {
  it('reads the night bounds, replacing a malformed one with the default', () => {
    expect(nightClocks({ start: '19:30', end: '7:00' })).toEqual({
      start: { hour: 19, minute: 30 },
      end: { hour: 7, minute: 0 },
    })
    expect(nightClocks({ start: '', end: '20h00' })).toEqual({
      start: { hour: 20, minute: 0 },
      end: { hour: 8, minute: 0 },
    })
  })
})

describe('computeDelta', () => {
  it('reports an upward direction when current exceeds previous', () => {
    expect(computeDelta(10, 6)).toEqual({ value: 4, direction: 'up' })
  })

  it('reports a downward direction when current is below previous', () => {
    expect(computeDelta(6, 10)).toEqual({ value: -4, direction: 'down' })
  })

  it('reports a flat direction when equal', () => {
    expect(computeDelta(5, 5)).toEqual({ value: 0, direction: 'flat' })
  })
})
