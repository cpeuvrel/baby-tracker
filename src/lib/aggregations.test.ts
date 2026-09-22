import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import {
  averageOfPoints,
  averageVolumeByDay,
  computeDelta,
  computeDiaperStats,
  computeFeedingStats,
  computeSleepStats,
  countDiapersByDay,
  countFeedingSessionsByDay,
  countNightWakingsByDay,
  sumSecondsByDay,
  sumVolumeByDay,
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

function diaperEntry(overrides: Partial<DiaperEntry>): DiaperEntry {
  return {
    id: 'd1',
    type: 'pee',
    occurredAt: '2026-03-05T10:00:00.000Z',
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

describe('computeDiaperStats', () => {
  it('counts entries per diaper type, defaulting to zero', () => {
    const entries = [
      diaperEntry({ type: 'pee' }),
      diaperEntry({ type: 'pee' }),
      diaperEntry({ type: 'poop' }),
    ]

    expect(computeDiaperStats(entries)).toEqual({ pee: 2, poop: 1, both: 0 })
  })
})

describe('sumSecondsByDay', () => {
  it('buckets sleep duration by local day, ignoring entries outside the range', () => {
    const entries = [
      sleepEntry({ startedAt: '2026-03-05T10:00:00', durationSeconds: 1000 }),
      sleepEntry({ startedAt: '2026-03-05T20:00:00', durationSeconds: 500 }),
      sleepEntry({ startedAt: '2026-03-01T10:00:00', durationSeconds: 9999 }),
    ]

    const buckets = sumSecondsByDay(['2026-03-04', '2026-03-05'], entries)

    expect(buckets).toEqual([
      { dayKey: '2026-03-04', value: 0 },
      { dayKey: '2026-03-05', value: 1500 },
    ])
  })
})

describe('sumVolumeByDay', () => {
  it('buckets bottle volume by local day and ignores solids', () => {
    const entries = [
      feedingEntry({ type: 'bottle', volumeMl: 100, occurredAt: '2026-03-05T10:00:00' }),
      feedingEntry({ type: 'bottle', volumeMl: 50, occurredAt: '2026-03-05T18:00:00' }),
      feedingEntry({ type: 'solid', volumeMl: null, occurredAt: '2026-03-05T12:00:00' }),
    ]

    const buckets = sumVolumeByDay(['2026-03-05'], entries)

    expect(buckets).toEqual([{ dayKey: '2026-03-05', value: 150 }])
  })
})

describe('averageVolumeByDay', () => {
  it('averages bottle volume per day, ignoring solids and days with no bottle', () => {
    const entries = [
      feedingEntry({ type: 'bottle', volumeMl: 100, occurredAt: '2026-03-05T10:00:00' }),
      feedingEntry({ type: 'bottle', volumeMl: 50, occurredAt: '2026-03-05T18:00:00' }),
      feedingEntry({ type: 'solid', volumeMl: null, occurredAt: '2026-03-05T12:00:00' }),
    ]

    const buckets = averageVolumeByDay(['2026-03-04', '2026-03-05'], entries)

    expect(buckets).toEqual([
      { dayKey: '2026-03-04', value: 0 },
      { dayKey: '2026-03-05', value: 75 },
    ])
  })
})

describe('countFeedingSessionsByDay', () => {
  it('counts bottle entries per day, ignoring solids', () => {
    const entries = [
      feedingEntry({ type: 'bottle', occurredAt: '2026-03-05T10:00:00' }),
      feedingEntry({ type: 'bottle', occurredAt: '2026-03-05T18:00:00' }),
      feedingEntry({ type: 'solid', occurredAt: '2026-03-05T12:00:00' }),
    ]

    expect(countFeedingSessionsByDay(['2026-03-05'], entries)).toEqual([
      { dayKey: '2026-03-05', value: 2 },
    ])
  })
})

describe('countNightWakingsByDay', () => {
  it('counts only entries starting during the night window per day', () => {
    const entries = [
      sleepEntry({ startedAt: '2026-03-05T21:00:00.000Z' }),
      sleepEntry({ startedAt: '2026-03-05T14:00:00.000Z' }),
    ]

    expect(countNightWakingsByDay(['2026-03-05'], entries)).toEqual([
      { dayKey: '2026-03-05', value: 1 },
    ])
  })
})

describe('countDiapersByDay', () => {
  it('counts diaper entries per day', () => {
    const entries = [
      diaperEntry({ occurredAt: '2026-03-05T08:00:00' }),
      diaperEntry({ occurredAt: '2026-03-05T18:00:00' }),
    ]

    expect(countDiapersByDay(['2026-03-05'], entries)).toEqual([{ dayKey: '2026-03-05', value: 2 }])
  })
})

describe('averageOfPoints', () => {
  it('averages the values of a list of points', () => {
    expect(
      averageOfPoints([
        { dayKey: '2026-03-04', value: 10 },
        { dayKey: '2026-03-05', value: 20 },
      ]),
    ).toBe(15)
  })

  it('returns zero for an empty list', () => {
    expect(averageOfPoints([])).toBe(0)
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
