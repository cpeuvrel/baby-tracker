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
} from './trendMetrics'

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
const values = (id: Parameters<typeof computeMetricSeries>[0]) =>
  computeMetricSeries(id, DAYS, bundle).map((point) => point.value)

describe('sleep metrics', () => {
  it('splits completed sleep into daytime and nighttime by start time', () => {
    // The night starting at 20:30 on the 5th counts on the 6th: sleep days start at night.
    expect(values('sleepTotal')).toEqual([1.5 * 3600, 10 * 3600])
    expect(values('sleepDay')).toEqual([1.5 * 3600, 0])
    expect(values('sleepNight')).toEqual([0, 10 * 3600])
  })

  it('starts sleep days at the baby\'s own night start', () => {
    const series = computeMetricSeries('sleepTotal', DAYS, bundle, { start: '21:00', end: '07:00' })
    expect(series.map((point) => point.value)).toEqual([11.5 * 3600, 0])
  })

  it('counts and measures daytime naps', () => {
    expect(values('napCount')).toEqual([2, 0])
    expect(values('napLength')).toEqual([45 * 60, 0])
    expect(computeMetricSummary('napCount', DAYS, bundle)).toBe(1)
  })

  it('averages the longest sleep over days that have one', () => {
    expect(values('sleepLongest')).toEqual([3600, 10 * 3600])
    expect(computeMetricSummary('sleepLongest', DAYS, bundle)).toBe(5.5 * 3600)
  })

  it('measures wake windows between completed sleeps', () => {
    // 10:00 → 13:00 (3h) on the 5th, and 13:30 → 20:30 (6h) ending with the night that counts on the 6th.
    expect(values('wakeWindow')).toEqual([3 * 3600, 6 * 3600])
    expect(computeMetricSummary('wakeWindow', DAYS, bundle)).toBe(4.5 * 3600)
  })
})

describe('filterMetricEntries', () => {
  it('keeps only the sleeps and diapers of the metric\'s daytime / nighttime split', () => {
    expect(filterMetricEntries('sleepDay', bundle).sleep.map((entry) => entry.id)).toEqual(['nap1', 'nap2', 'running'])
    expect(filterMetricEntries('sleepNight', bundle).sleep.map((entry) => entry.id)).toEqual(['night'])
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
