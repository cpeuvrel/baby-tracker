import {
  averageVolumeByDay,
  countDiapersByDay,
  countFeedingSessionsByDay,
  countNightWakingsByDay,
  DEFAULT_NIGHTTIME_HOURS,
  sumSecondsByDay,
  sumVolumeByDay,
  type DailyPoint,
} from './aggregations'
import { formatDuration } from './duration'
import type { DiaperEntry, FeedingEntry, NighttimeHours, SleepEntry } from '../types/models'

export type TrendMetricId =
  | 'feedSessions'
  | 'feedVolume'
  | 'feedAvgVolume'
  | 'sleepTotal'
  | 'nightWakings'
  | 'diaperCount'

export type TrendKind = 'feeding' | 'sleep' | 'diaper'

/** How a metric is drawn in the Graph view: stacked blocks for counts, plain bars for quantities. */
export type TrendChartStyle = 'stack' | 'bar'

export interface TrendMetricMeta {
  id: TrendMetricId
  title: string
  section: string
  colorVar: string
  kind: TrendKind
  chartStyle: TrendChartStyle
  /** Legend label under the graph. */
  seriesLabel: string
  /** Unit word used in the delta caption ("Fewer bottles than…"). */
  unitWord: string
}

export const TREND_METRICS: TrendMetricMeta[] = [
  {
    id: 'feedSessions',
    title: 'Bottles',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    chartStyle: 'stack',
    seriesLabel: 'Bottle',
    unitWord: 'bottles',
  },
  {
    id: 'feedVolume',
    title: 'Total volume',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    chartStyle: 'bar',
    seriesLabel: 'Bottle',
    unitWord: 'mL',
  },
  {
    id: 'feedAvgVolume',
    title: 'Average volume',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    chartStyle: 'bar',
    seriesLabel: 'Bottle',
    unitWord: 'mL',
  },
  {
    id: 'sleepTotal',
    title: 'Total sleep',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    chartStyle: 'bar',
    seriesLabel: 'Sleep',
    unitWord: 'sleep',
  },
  {
    id: 'nightWakings',
    title: 'Night wakings',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    chartStyle: 'stack',
    seriesLabel: 'Night waking',
    unitWord: 'wakings',
  },
  {
    id: 'diaperCount',
    title: 'Diapers',
    section: 'Diaper',
    colorVar: '--category-diaper',
    kind: 'diaper',
    chartStyle: 'stack',
    seriesLabel: 'Diaper',
    unitWord: 'diapers',
  },
]

export function getTrendMetric(id: string): TrendMetricMeta | undefined {
  return TREND_METRICS.find((metric) => metric.id === id)
}

export interface TrendEntriesBundle {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
}

export function computeMetricSeries(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
): DailyPoint[] {
  switch (id) {
    case 'feedSessions':
      return countFeedingSessionsByDay(dayKeys, entries.feeding)
    case 'feedVolume':
      return sumVolumeByDay(dayKeys, entries.feeding)
    case 'feedAvgVolume':
      return averageVolumeByDay(dayKeys, entries.feeding)
    case 'sleepTotal':
      return sumSecondsByDay(dayKeys, entries.sleep)
    case 'nightWakings':
      return countNightWakingsByDay(dayKeys, entries.sleep, nightRange)
    case 'diaperCount':
      return countDiapersByDay(dayKeys, entries.diaper)
  }
}

export function formatMetricValue(id: TrendMetricId, value: number): string {
  switch (id) {
    case 'feedSessions':
    case 'nightWakings':
    case 'diaperCount':
      return value.toFixed(1)
    case 'feedVolume':
    case 'feedAvgVolume':
      return `${Math.round(value)} mL`
    case 'sleepTotal':
      return formatDuration(Math.round(value))
  }
}

const HEADLINE_SUFFIX: Record<TrendMetricId, string> = {
  feedSessions: 'bottles / day',
  feedVolume: '/ day',
  feedAvgVolume: 'average',
  sleepTotal: '/ day',
  nightWakings: 'wakings / day',
  diaperCount: 'diapers / day',
}

const DAY_HEADLINE_SUFFIX: Record<TrendMetricId, string> = {
  feedSessions: 'bottles',
  feedVolume: '',
  feedAvgVolume: 'average',
  sleepTotal: '',
  nightWakings: 'wakings',
  diaperCount: 'diapers',
}

export function formatMetricHeadline(id: TrendMetricId, average: number): string {
  return `${formatMetricValue(id, average)} ${HEADLINE_SUFFIX[id]}`
}

/** Headline for a single selected day, e.g. "5 bottles" or "620 mL". */
export function formatMetricDayHeadline(id: TrendMetricId, value: number): string {
  return `${formatMetricValue(id, value)} ${DAY_HEADLINE_SUFFIX[id]}`.trim()
}

/** Short tick label for the Graph view's y axis. */
export function formatMetricAxisValue(id: TrendMetricId, value: number): string {
  switch (id) {
    case 'sleepTotal':
      return `${Math.round(value / 3600)}h`
    default:
      return String(Math.round(value))
  }
}

/** Evenly spaced y axis ticks (whole units: counts, mL or hours) from 0 up to a round maximum covering `max`. */
export function computeAxisTicks(id: TrendMetricId, max: number): number[] {
  const unit = id === 'sleepTotal' ? 3600 : 1
  const target = max / unit / 4
  const magnitude = target > 0 ? 10 ** Math.floor(Math.log10(target)) : 1
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((m) => m >= target) ?? 1)
  const count = Math.max(1, Math.ceil(max / unit / step))
  return Array.from({ length: count + 1 }, (_, index) => index * step * unit)
}
