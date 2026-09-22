import { describe, expect, it } from 'vitest'
import type { FeedingEntry } from '../types/models'
import {
  computeMetricSeries,
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
    expect(getTrendMetric('feedVolume')?.title).toBe('Volume total')
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
    expect(formatMetricValue('sleepTotal', 3725)).toBe('1h 02min')
  })

  it('formats count metrics with one decimal', () => {
    expect(formatMetricValue('feedSessions', 3.6)).toBe('3.6')
  })
})

describe('formatMetricHeadline', () => {
  it('appends the metric-specific suffix', () => {
    expect(formatMetricHeadline('feedSessions', 3.6)).toBe('3.6 biberons / jour')
    expect(formatMetricHeadline('feedAvgVolume', 128)).toBe('128 mL en moyenne')
  })
})
