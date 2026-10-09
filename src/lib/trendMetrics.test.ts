import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import {
  computeAxisTicks,
  computeMetricBreakdown,
  computeMetricSeries,
  computeMetricSummary,
  filterMetricEntries,
  formatMetricAxisValue,
  formatMetricDayHeadline,
  formatMetricHeadline,
  formatMetricValue,
  getTrendMetric,
  TREND_METRICS,
  isNightSleep,
  metricHeadlineDayKey,
  metricSleepSegments,
} from './trendMetrics'
import { DEFAULT_NIGHTTIME_HOURS } from './aggregations'
import { rollingDayFrame } from './timeline'

const feeding: FeedingEntry = {
  id: 'f1',
  type: 'bottle',
  occurredAt: '2026-03-05T10:00:00.000Z',
  volumeMl: 100,
  foodType: null,
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T10:00:00.000Z',
}

describe('getTrendMetric', () => {
  it('finds a metric by id', () => {
    expect(getTrendMetric('feedVolume')?.title).toBe('Amount Bottlefed')
  })

  it('returns undefined for an unknown id', () => {
    expect(getTrendMetric('unknown')).toBeUndefined()
  })

  it('lists every metric with a section and a kind', () => {
    for (const metric of TREND_METRICS) {
      expect(metric.section.length).toBeGreaterThan(0)
      expect(['feeding', 'sleep', 'diaper']).toContain(metric.kind)
    }
  })
})

describe('computeMetricSeries', () => {
  it('dispatches to the feeding volume series for feedVolume', () => {
    const series = computeMetricSeries('feedVolume', ['2026-03-05'], {
      feeding: [feeding],
      sleep: [],
      diaper: [],
    })

    expect(series).toEqual([{ dayKey: '2026-03-05', value: 100 }])
  })

  it('dispatches to the feeding session count for feedSessions', () => {
    const series = computeMetricSeries('feedSessions', ['2026-03-05'], {
      feeding: [feeding],
      sleep: [],
      diaper: [],
    })

    expect(series).toEqual([{ dayKey: '2026-03-05', value: 1 }])
  })
})

describe('formatMetricValue', () => {
  it('formats volume metrics in mL', () => {
    expect(formatMetricValue('feedVolume', 459)).toBe('459 mL')
  })

  it('formats duration metrics with formatDuration', () => {
    expect(formatMetricValue('sleepTotal', 3725)).toBe('1h 02m')
  })

  it('formats count metrics with at most one decimal', () => {
    expect(formatMetricValue('feedSessions', 3.6)).toBe('3.6')
    expect(formatMetricValue('diaperCount', 0)).toBe('0')
    expect(formatMetricValue('napCount', 1.34)).toBe('1.3')
  })
})

describe('formatMetricHeadline', () => {
  it('appends the metric-specific suffix', () => {
    expect(formatMetricHeadline('feedSessions', 3.6)).toBe('3.6 sessions per day')
    expect(formatMetricHeadline('feedVolume', 464)).toBe('464 mL per day')
    expect(formatMetricHeadline('wakeWindow', 4 * 3600 + 46 * 60)).toBe('4h 46m average')
    expect(formatMetricHeadline('feedAvgVolume', 128)).toBe('128 mL average')
  })
})

describe('formatMetricDayHeadline', () => {
  it('drops "per day" and shows whole counts or a total', () => {
    expect(formatMetricDayHeadline('feedSessions', 5)).toBe('5 sessions')
    expect(formatMetricDayHeadline('diaperCount', 7)).toBe('7 diapers')
    expect(formatMetricDayHeadline('feedVolume', 540)).toBe('540 mL total')
    expect(formatMetricDayHeadline('feedAvgVolume', 128)).toBe('128 mL average')
    expect(formatMetricDayHeadline('sleepLongest', 3 * 3600)).toBe(`${formatMetricValue('sleepLongest', 3 * 3600)} longest`)
  })
})

describe('computeAxisTicks', () => {
  it('rounds volumes up to a round maximum', () => {
    expect(computeAxisTicks('feedVolume', 660)).toEqual([0, 200, 400, 600, 800])
  })

  it('keeps whole steps for small counts', () => {
    expect(computeAxisTicks('feedSessions', 5)).toEqual([0, 2, 4, 6])
    expect(computeAxisTicks('diaperCount', 0)).toEqual([0, 1])
  })

  it('steps sleep in whole hours', () => {
    expect(computeAxisTicks('sleepTotal', 14 * 3600)).toEqual([0, 5, 10, 15].map((h) => h * 3600))
    expect(formatMetricAxisValue('sleepTotal', 5 * 3600)).toBe('5h')
  })

  it('steps short durations in minutes', () => {
    expect(computeAxisTicks('napLength', 50 * 60)).toEqual([0, 20, 40, 60].map((m) => m * 60))
    expect(formatMetricAxisValue('napLength', 40 * 60)).toBe('40m')
  })
})

function sleepEntry(id: string, startedAt: string, endedAt: string | null): SleepEntry {
  return {
    id,
    startedAt,
    endedAt,
    durationSeconds: endedAt ? (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000 : null,
    notes: '',
    createdBy: 'uid1',
    createdAt: startedAt,
  }
}

function diaperEntry(id: string, occurredAt: string): DiaperEntry {
  return { id, type: 'wet', occurredAt, notes: '', createdBy: 'uid1', createdAt: occurredAt }
}

// Paris is UTC+1 in March: nighttime (20:00 – 08:00) is 19:00Z – 07:00Z.
const DAYS = ['2026-03-05', '2026-03-06']
const sleeps = [
  sleepEntry('nap1', '2026-03-05T09:00:00.000Z', '2026-03-05T10:00:00.000Z'),
  sleepEntry('nap2', '2026-03-05T13:00:00.000Z', '2026-03-05T13:30:00.000Z'),
  sleepEntry('night', '2026-03-05T19:30:00.000Z', '2026-03-06T05:30:00.000Z'),
  sleepEntry('running', '2026-03-06T08:00:00.000Z', null),
]
const bundle = {
  feeding: [
    feeding,
    { ...feeding, id: 'f2', occurredAt: '2026-03-05T14:00:00.000Z', volumeMl: 140 },
    { ...feeding, id: 'f3', type: 'solid' as const, occurredAt: '2026-03-06T11:00:00.000Z', volumeMl: null },
  ],
  sleep: sleeps,
  diaper: [diaperEntry('d1', '2026-03-05T10:00:00.000Z'), diaperEntry('d2', '2026-03-05T21:00:00.000Z')],
}
/** Noon (Paris) on the 6th: the running sleep has lasted 3 hours. */
const NOW = new Date('2026-03-06T11:00:00.000Z')
const values = (id: Parameters<typeof computeMetricSeries>[0]) =>
  computeMetricSeries(id, DAYS, bundle, undefined, NOW).map((point) => point.value)

describe('sleep metrics', () => {
  it('counts each sleep whole on the day the baby woke up, never split', () => {
    // 5th: naps 10:00–11:00 and 14:00–14:30.
    // 6th: the whole night from 20:30 on the 5th to 06:30 (10h), then a sleep running since 09:00 (3h until noon).
    expect(values('sleepTotal')).toEqual([1.5 * 3600, 13 * 3600])
    expect(values('sleepDay')).toEqual([1.5 * 3600, 3 * 3600])
    expect(values('sleepNight')).toEqual([0, 10 * 3600])
  })

  it('makes a sleep a night as a whole when it touches the nighttime hours', () => {
    const night = { start: '21:00', end: '07:00' }
    const series = (id: 'sleepDay' | 'sleepNight') =>
      computeMetricSeries(id, DAYS, bundle, night, NOW).map((point) => point.value)
    // Started at 20:30, before this baby's night, but still asleep at 21:00: the whole 10h is a night.
    expect(series('sleepDay')).toEqual([1.5 * 3600, 3 * 3600])
    expect(series('sleepNight')).toEqual([0, 10 * 3600])
  })

  it('counts a night that starts before the nighttime hours on the morning it ends', () => {
    // 19:30 on the 5th → 08:00 on the 6th (Paris), the night starting at 20:00.
    const early = sleepEntry('early', '2026-03-05T18:30:00.000Z', '2026-03-06T07:00:00.000Z')
    const series = (id: 'sleepTotal' | 'sleepLongest') =>
      computeMetricSeries(id, DAYS, { ...bundle, sleep: [early] }, undefined, NOW).map((point) => point.value)
    expect(series('sleepTotal')).toEqual([0, 12.5 * 3600])
    expect(series('sleepLongest')).toEqual([0, 12.5 * 3600])
  })

  it('averages a per-day total over the elapsed part of the period', () => {
    // 14.5h over the 1.5 days elapsed at noon on the 6th.
    expect(computeMetricSummary('sleepTotal', DAYS, bundle, undefined, NOW)).toBeCloseTo((14.5 * 3600) / 1.5)
    // Once the period is over, over all of its days.
    expect(computeMetricSummary('sleepTotal', DAYS, bundle, undefined, new Date('2026-03-06T23:00:00.000Z'))).toBe(
      (5 * 3600 + 6.5 * 3600 + 15 * 3600) / 2,
    )
  })

  it('counts and measures daytime naps', () => {
    expect(values('napCount')).toEqual([2, 0])
    expect(values('napLength')).toEqual([45 * 60, 0])
    expect(computeMetricSummary('napCount', DAYS, bundle)).toBe(1)
  })

  it('counts each day\'s longest sleep on the morning it ends; the headline is the period\'s longest', () => {
    expect(values('sleepLongest')).toEqual([3600, 10 * 3600])
    expect(computeMetricSummary('sleepLongest', DAYS, bundle)).toBe(10 * 3600)
    expect(formatMetricHeadline('sleepLongest', 10 * 3600)).toBe(`${formatMetricValue('sleepLongest', 10 * 3600)} longest`)
    expect(metricHeadlineDayKey('sleepLongest', DAYS, bundle)).toBe('2026-03-06')
  })

  it('has no headline day for metrics over the whole period', () => {
    expect(metricHeadlineDayKey('sleepTotal', DAYS, bundle)).toBeNull()
    expect(metricHeadlineDayKey('sleepLongest', DAYS, { ...bundle, sleep: [] })).toBeNull()
  })

  it('measures wake windows between completed sleeps, on the day each one ends', () => {
    // 11:00 → 14:00 (3h) and 14:30 → 20:30 (6h), both on the 5th.
    expect(values('wakeWindow')).toEqual([4.5 * 3600, 0])
    expect(computeMetricSummary('wakeWindow', DAYS, bundle)).toBe(4.5 * 3600)
  })
})

describe('metricSleepSegments with a selected day', () => {
  const highlighted = (id: Parameters<typeof metricSleepSegments>[0], focus: string | null) => [
    ...new Set(
      metricSleepSegments(id, DAYS, sleeps, undefined, NOW, undefined, focus)
        .filter((segment) => segment.inMetric)
        .map((segment) => segment.entry.id),
    ),
  ]

  it('brings out only the selected day\'s longest sleep, the evening before included', () => {
    expect(highlighted('sleepLongest', null)).toEqual(['nap1', 'night'])
    expect(highlighted('sleepLongest', '2026-03-06')).toEqual(['night'])
    expect(highlighted('sleepLongest', '2026-03-05')).toEqual(['nap1'])
    // The night starts on the 5th: its evening piece is brought out too.
    const nightPieces = metricSleepSegments('sleepLongest', DAYS, sleeps, undefined, NOW, undefined, '2026-03-06')
      .filter((segment) => segment.inMetric)
      .map((segment) => segment.dayKey)
    expect(nightPieces).toContain('2026-03-05')
    expect(nightPieces).toContain('2026-03-06')
  })

  it('brings out the sleeps counted on the selected day', () => {
    expect(highlighted('sleepTotal', '2026-03-06')).toEqual(['night', 'running'])
    expect(highlighted('sleepNight', '2026-03-05')).toEqual([])
    expect(highlighted('napCount', '2026-03-05')).toEqual(['nap1', 'nap2'])
    // Wake windows count on the day of the sleep that ends them: the sleeps starting that day.
    expect(highlighted('wakeWindow', '2026-03-06')).toEqual(['running'])
  })
})

describe('isNightSleep', () => {
  // Paris is UTC+1 in March; nighttime 20:00 – 08:00.
  const at = (id: string, start: string, end: string) => isNightSleep(sleepEntry(id, start, end), DEFAULT_NIGHTTIME_HOURS)

  it('is a night when the sleep reaches the nighttime hours, wherever it starts and ends', () => {
    expect(at('19h30-8h00', '2026-03-05T18:30:00.000Z', '2026-03-06T07:00:00.000Z')).toBe(true)
    expect(at('21h00-8h15', '2026-03-05T20:00:00.000Z', '2026-03-06T07:15:00.000Z')).toBe(true)
    expect(at('5h-9h', '2026-03-06T04:00:00.000Z', '2026-03-06T08:00:00.000Z')).toBe(true)
  })

  it('is a nap when the sleep stays outside the nighttime hours', () => {
    expect(at('14h-15h', '2026-03-05T13:00:00.000Z', '2026-03-05T14:00:00.000Z')).toBe(false)
    expect(at('8h30-9h30', '2026-03-05T07:30:00.000Z', '2026-03-05T08:30:00.000Z')).toBe(false)
  })
})

describe('rolling days', () => {
  // 24-hour windows ending at noon (Paris): the 6th's is from noon on the 5th to noon on the 6th.
  const frame = rollingDayFrame(NOW)
  const rolling = (id: Parameters<typeof computeMetricSeries>[0]) =>
    computeMetricSeries(id, DAYS, bundle, undefined, NOW, frame).map((point) => point.value)

  it('counts each sleep whole in the rolling window the baby woke up in', () => {
    // 5th's window: the morning nap. 6th's: the afternoon nap, the night and the running sleep.
    expect(rolling('sleepTotal')).toEqual([3600, 13.5 * 3600])
    expect(rolling('sleepDay')).toEqual([3600, 3.5 * 3600])
    expect(rolling('sleepNight')).toEqual([0, 10 * 3600])
  })

  it('counts events in the window they fall in, a window ending just before its end', () => {
    // The noon solid on the 6th starts the next window.
    expect(rolling('feedSessions')).toEqual([1, 1])
  })

  it('counts the longest sleep in the window it ends in', () => {
    expect(rolling('sleepLongest')).toEqual([3600, 10 * 3600])
  })

  it('averages a per-day total over whole windows, all of them elapsed', () => {
    expect(computeMetricSummary('sleepTotal', DAYS, bundle, undefined, NOW, frame)).toBe((14.5 * 3600) / 2)
  })
})

describe('filterMetricEntries', () => {
  it('keeps only the sleeps and diapers of the metric\'s daytime / nighttime split', () => {
    const ids = (id: Parameters<typeof filterMetricEntries>[0]) =>
      filterMetricEntries(id, bundle, undefined, DAYS, NOW).sleep.map((entry) => entry.id)
    expect(ids('sleepDay')).toEqual(['nap1', 'nap2', 'running'])
    expect(ids('sleepNight')).toEqual(['night'])
    expect(ids('sleepLongest')).toEqual(['nap1', 'night'])
    expect(filterMetricEntries('diaperNight', bundle).diaper.map((entry) => entry.id)).toEqual(['d2'])
    expect(filterMetricEntries('sleepTotal', bundle)).toBe(bundle)
  })
})

describe('feed metrics', () => {
  it('averages the bottle size over bottles, not days', () => {
    expect(computeMetricSummary('feedAvgVolume', DAYS, bundle)).toBe(120)
    expect(computeMetricSummary('feedVolume', DAYS, bundle)).toBe(120)
  })

  it('measures the time between consecutive feedings', () => {
    expect(values('feedInterval')).toEqual([4 * 3600, 21 * 3600])
    expect(computeMetricSummary('feedInterval', DAYS, bundle)).toBe(12.5 * 3600)
  })

  it('breaks feed sessions down by type, per day', () => {
    expect(computeMetricBreakdown('feedSessions', DAYS, bundle)).toEqual([
      { label: 'Bottle Feed', colorVar: '--action', value: 1 },
      { label: 'Solids', colorVar: '--category-growth', value: 0.5 },
    ])
  })
})

describe('diaper metrics', () => {
  it('splits diapers into daytime and nighttime', () => {
    expect(values('diaperCount')).toEqual([2, 0])
    expect(values('diaperDay')).toEqual([1, 0])
    expect(values('diaperNight')).toEqual([1, 0])
  })
})
