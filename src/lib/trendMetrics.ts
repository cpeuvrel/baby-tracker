import { DEFAULT_NIGHTTIME_HOURS, startsDuringNight, type DailyPoint } from './aggregations'
import { formatDuration } from './duration'
import { activityWindowStart, dayKey, nightDayKey, type DateRange } from './timeline'
import type { DiaperEntry, FeedingEntry, FeedingType, NighttimeHours, SleepEntry } from '../types/models'

export type TrendMetricId =
  | 'feedSessions'
  | 'feedVolume'
  | 'feedAvgVolume'
  | 'feedInterval'
  | 'diaperCount'
  | 'diaperDay'
  | 'diaperNight'
  | 'sleepTotal'
  | 'sleepDay'
  | 'sleepNight'
  | 'sleepLongest'
  | 'napCount'
  | 'napLength'
  | 'wakeWindow'

export type TrendKind = 'feeding' | 'sleep' | 'diaper'

/** How a metric is drawn in the Graph view: stacked blocks for counts, plain bars for quantities. */
export type TrendChartStyle = 'stack' | 'bar'

export type TrendValueType = 'count' | 'volume' | 'duration'

/**
 * How a day's samples become its value, and the period's samples its headline:
 * `sum` → the day's total, averaged per day over the period ("per day");
 * `mean` → the mean of the samples, over the day or over the whole period ("average").
 */
export type TrendReducer = 'sum' | 'mean'

export interface TrendMetricMeta {
  id: TrendMetricId
  title: string
  section: string
  colorVar: string
  kind: TrendKind
  valueType: TrendValueType
  reducer: TrendReducer
  /** Legend label under the graph. */
  seriesLabel: string
  /** Unit word of count metrics ("3.5 sessions per day"). */
  unitWord?: string
  /** Delta caption start when the value went up / down ("More sleep than the previous 7 days"). */
  deltaWords: [up: string, down: string]
}

export const TREND_METRICS: TrendMetricMeta[] = [
  {
    id: 'feedSessions',
    title: 'Feed Sessions',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    valueType: 'count',
    reducer: 'sum',
    seriesLabel: 'Feed',
    unitWord: 'sessions',
    deltaWords: ['More feed sessions', 'Fewer feed sessions'],
  },
  {
    id: 'feedVolume',
    title: 'Amount Bottlefed',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    valueType: 'volume',
    reducer: 'sum',
    seriesLabel: 'Bottle',
    deltaWords: ['More milk', 'Less milk'],
  },
  {
    id: 'feedAvgVolume',
    title: 'Bottle Size',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    valueType: 'volume',
    reducer: 'mean',
    seriesLabel: 'Bottle',
    deltaWords: ['Bigger bottles', 'Smaller bottles'],
  },
  {
    id: 'feedInterval',
    title: 'Time Btwn Feedings',
    section: 'Feed',
    colorVar: '--category-feeding',
    kind: 'feeding',
    valueType: 'duration',
    reducer: 'mean',
    seriesLabel: 'Time between feedings',
    deltaWords: ['Longer gaps between feedings', 'Shorter gaps between feedings'],
  },
  {
    id: 'diaperCount',
    title: 'Total Diapers',
    section: 'Diaper',
    colorVar: '--category-diaper',
    kind: 'diaper',
    valueType: 'count',
    reducer: 'sum',
    seriesLabel: 'Diaper',
    unitWord: 'diapers',
    deltaWords: ['More diapers', 'Fewer diapers'],
  },
  {
    id: 'diaperDay',
    title: 'Daytime Diapers',
    section: 'Diaper',
    colorVar: '--category-diaper',
    kind: 'diaper',
    valueType: 'count',
    reducer: 'sum',
    seriesLabel: 'Daytime diaper',
    unitWord: 'diapers',
    deltaWords: ['More daytime diapers', 'Fewer daytime diapers'],
  },
  {
    id: 'diaperNight',
    title: 'Nighttime Diapers',
    section: 'Diaper',
    colorVar: '--category-diaper',
    kind: 'diaper',
    valueType: 'count',
    reducer: 'sum',
    seriesLabel: 'Nighttime diaper',
    unitWord: 'diapers',
    deltaWords: ['More nighttime diapers', 'Fewer nighttime diapers'],
  },
  {
    id: 'sleepTotal',
    title: 'Total Sleep',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'duration',
    reducer: 'sum',
    seriesLabel: 'Sleep',
    deltaWords: ['More sleep', 'Less sleep'],
  },
  {
    id: 'sleepDay',
    title: 'Daytime Sleep',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'duration',
    reducer: 'sum',
    seriesLabel: 'Daytime sleep',
    deltaWords: ['More daytime sleep', 'Less daytime sleep'],
  },
  {
    id: 'sleepNight',
    title: 'Nighttime Sleep',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'duration',
    reducer: 'sum',
    seriesLabel: 'Nighttime sleep',
    deltaWords: ['More nighttime sleep', 'Less nighttime sleep'],
  },
  {
    id: 'sleepLongest',
    title: 'Longest Sleep',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'duration',
    reducer: 'mean',
    seriesLabel: 'Longest sleep',
    deltaWords: ['Longer longest sleep', 'Shorter longest sleep'],
  },
  {
    id: 'napCount',
    title: 'Daytime Naps',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'count',
    reducer: 'sum',
    seriesLabel: 'Nap',
    unitWord: 'naps',
    deltaWords: ['More naps', 'Fewer naps'],
  },
  {
    id: 'napLength',
    title: 'Daytime Nap Length',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'duration',
    reducer: 'mean',
    seriesLabel: 'Nap',
    deltaWords: ['Longer naps', 'Shorter naps'],
  },
  {
    id: 'wakeWindow',
    title: 'Wake Window',
    section: 'Sleep',
    colorVar: '--category-sleep',
    kind: 'sleep',
    valueType: 'duration',
    reducer: 'mean',
    seriesLabel: 'Wake window',
    deltaWords: ['Longer wake windows', 'Shorter wake windows'],
  },
]

export function getTrendMetric(id: string): TrendMetricMeta | undefined {
  return TREND_METRICS.find((metric) => metric.id === id)
}

export function chartStyleOf(metric: TrendMetricMeta): TrendChartStyle {
  return metric.valueType === 'count' ? 'stack' : 'bar'
}

export interface TrendEntriesBundle {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
}

/**
 * Day an entry of the metric counts on: sleep days start at the beginning of the night
 * (the baby's nighttime hours), every other metric uses calendar days.
 */
export function metricDayKeyOf(
  kind: TrendKind,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
): (date: string) => string {
  return kind === 'sleep'
    ? (date) => nightDayKey(new Date(date), nightRange.start)
    : (date) => dayKey(new Date(date))
}

/** Range to load for a period of calendar days: from the start of the night before, so its first sleep day is complete. */
export function trendFetchRange(range: DateRange, nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS): DateRange {
  return { start: activityWindowStart(range.start, nightRange.start), end: range.end }
}

/** Keeps only the entries that make up the metric's daytime / nighttime split (the others are left as they are). */
export function filterMetricEntries<T extends Partial<TrendEntriesBundle>>(
  id: TrendMetricId,
  entries: T,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
): T {
  const isNight = (date: string) => startsDuringNight(date, nightRange)
  switch (id) {
    case 'sleepDay':
    case 'napCount':
    case 'napLength':
      return { ...entries, sleep: entries.sleep?.filter((entry) => !isNight(entry.startedAt)) }
    case 'sleepNight':
      return { ...entries, sleep: entries.sleep?.filter((entry) => isNight(entry.startedAt)) }
    case 'diaperDay':
      return { ...entries, diaper: entries.diaper?.filter((entry) => !isNight(entry.occurredAt)) }
    case 'diaperNight':
      return { ...entries, diaper: entries.diaper?.filter((entry) => isNight(entry.occurredAt)) }
    default:
      return entries
  }
}

type Samples = Map<string, number[]>
type DayKeyOf = (date: string) => string

function emptySamples(dayKeys: string[]): Samples {
  return new Map(dayKeys.map((key) => [key, []]))
}

function addSample(samples: Samples, key: string, value: number) {
  samples.get(key)?.push(value)
}

/** Gaps between consecutive events, each counted on the day of the event that ends it. */
function gapSamples(dayKeys: string[], keyOf: DayKeyOf, events: { start: string; end: string }[]): Samples {
  const samples = emptySamples(dayKeys)
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = (new Date(sorted[index].start).getTime() - new Date(sorted[index - 1].end).getTime()) / 1000
    if (gap > 0) addSample(samples, keyOf(sorted[index].start), gap)
  }
  return samples
}

function completedSleeps(entries: SleepEntry[]) {
  return entries.filter(
    (entry): entry is SleepEntry & { endedAt: string; durationSeconds: number } =>
      entry.endedAt != null && entry.durationSeconds != null,
  )
}

/** Every value that makes up the metric, grouped by the day it counts on. */
function metricSamples(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
  nightRange: NighttimeHours,
): Samples {
  const samples = emptySamples(dayKeys)
  const keyOf = metricDayKeyOf(getTrendMetric(id)?.kind ?? 'feeding', nightRange)
  const isNight = (date: string) => startsDuringNight(date, nightRange)
  const bottlesWithVolume = entries.feeding.filter((entry) => entry.type === 'bottle' && entry.volumeMl != null)
  const sleeps = completedSleeps(entries.sleep)
  const naps = sleeps.filter((entry) => !isNight(entry.startedAt))

  switch (id) {
    case 'feedSessions':
      for (const entry of entries.feeding) addSample(samples, keyOf(entry.occurredAt), 1)
      return samples
    case 'feedVolume':
    case 'feedAvgVolume':
      for (const entry of bottlesWithVolume) addSample(samples, keyOf(entry.occurredAt), entry.volumeMl ?? 0)
      return samples
    case 'feedInterval':
      return gapSamples(
        dayKeys,
        keyOf,
        entries.feeding.map((entry) => ({ start: entry.occurredAt, end: entry.occurredAt })),
      )
    case 'diaperCount':
    case 'diaperDay':
    case 'diaperNight':
      for (const entry of entries.diaper) {
        if (id === 'diaperDay' && isNight(entry.occurredAt)) continue
        if (id === 'diaperNight' && !isNight(entry.occurredAt)) continue
        addSample(samples, keyOf(entry.occurredAt), 1)
      }
      return samples
    case 'sleepTotal':
    case 'sleepDay':
    case 'sleepNight':
      for (const entry of sleeps) {
        if (id === 'sleepDay' && isNight(entry.startedAt)) continue
        if (id === 'sleepNight' && !isNight(entry.startedAt)) continue
        addSample(samples, keyOf(entry.startedAt), entry.durationSeconds)
      }
      return samples
    case 'sleepLongest':
      for (const entry of sleeps) addSample(samples, keyOf(entry.startedAt), entry.durationSeconds)
      for (const [key, values] of samples) samples.set(key, values.length > 0 ? [Math.max(...values)] : [])
      return samples
    case 'napCount':
      for (const entry of naps) addSample(samples, keyOf(entry.startedAt), 1)
      return samples
    case 'napLength':
      for (const entry of naps) addSample(samples, keyOf(entry.startedAt), entry.durationSeconds)
      return samples
    case 'wakeWindow':
      return gapSamples(
        dayKeys,
        keyOf,
        sleeps.map((entry) => ({ start: entry.startedAt, end: entry.endedAt })),
      )
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function mean(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0
}

/** The metric's value for each day of `dayKeys` (0 for a day with nothing to measure). */
export function computeMetricSeries(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
): DailyPoint[] {
  const reduce = getTrendMetric(id)?.reducer === 'mean' ? mean : sum
  const samples = metricSamples(id, dayKeys, entries, nightRange)
  return dayKeys.map((key) => ({ dayKey: key, value: reduce(samples.get(key) ?? []) }))
}

/**
 * The period's headline value: the per-day average of a `sum` metric,
 * or the mean of every sample of a `mean` metric (days without any don't count).
 */
export function computeMetricSummary(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
): number {
  if (getTrendMetric(id)?.reducer === 'mean') {
    return mean([...metricSamples(id, dayKeys, entries, nightRange).values()].flat())
  }
  return mean(computeMetricSeries(id, dayKeys, entries, nightRange).map((point) => point.value))
}

export interface TrendBreakdownItem {
  label: string
  colorVar: string
  value: number
}

const FEEDING_TYPES: { type: FeedingType; label: string; colorVar: string }[] = [
  { type: 'bottle', label: 'Bottle Feed', colorVar: '--action' },
  { type: 'solid', label: 'Solids', colorVar: '--category-growth' },
]

/** Per-type split shown under a feed metric's headline (types with nothing in the period are left out). */
export function computeMetricBreakdown(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
): TrendBreakdownItem[] {
  if (dayKeys.length === 0) return []
  switch (id) {
    case 'feedSessions': {
      const inPeriod = new Set(dayKeys)
      const feedings = entries.feeding.filter((entry) => inPeriod.has(dayKey(new Date(entry.occurredAt))))
      return FEEDING_TYPES.map(({ type, label, colorVar }) => ({
        label,
        colorVar,
        value: feedings.filter((entry) => entry.type === type).length / dayKeys.length,
      })).filter((item) => item.value > 0)
    }
    case 'feedVolume': {
      const value = computeMetricSummary(id, dayKeys, entries)
      return value > 0 ? [{ label: 'Bottle', colorVar: '--action', value }] : []
    }
    default:
      return []
  }
}

/** Counts keep one decimal, without a trailing ".0" ("3.5", "4"). */
function formatCount(value: number): string {
  return String(Math.round(value * 10) / 10)
}

export function formatMetricValue(id: TrendMetricId, value: number): string {
  switch (getTrendMetric(id)?.valueType) {
    case 'volume':
      return `${Math.round(value)} mL`
    case 'duration':
      return formatDuration(Math.round(value))
    default:
      return formatCount(value)
  }
}

/** Row subtitle / detail headline for the period, e.g. "3.5 sessions per day", "464 mL per day", "132 mL average". */
export function formatMetricHeadline(id: TrendMetricId, value: number): string {
  const metric = getTrendMetric(id)
  if (metric?.reducer === 'mean') return `${formatMetricValue(id, value)} average`
  return [formatMetricValue(id, value), metric?.unitWord, 'per day'].filter(Boolean).join(' ')
}

/** Headline for a single selected day (no "per day": it is that day's own value), e.g. "5 sessions" or "620 mL total". */
export function formatMetricDayHeadline(id: TrendMetricId, value: number): string {
  const metric = getTrendMetric(id)
  if (id === 'sleepLongest') return `${formatMetricValue(id, value)} longest`
  if (metric?.reducer === 'mean') return `${formatMetricValue(id, value)} average`
  if (metric?.valueType === 'count') return `${Math.round(value)} ${metric.unitWord}`
  return `${formatMetricValue(id, value)} total`
}

/** Seconds per y axis unit of a duration graph: hours, or minutes for short durations. */
function durationAxisUnit(max: number): number {
  return max >= 2 * 3600 ? 3600 : 60
}

/** Short tick label for the Graph view's y axis. */
export function formatMetricAxisValue(id: TrendMetricId, value: number): string {
  if (getTrendMetric(id)?.valueType !== 'duration' || value === 0) return String(Math.round(value))
  return value % 3600 === 0 ? `${value / 3600}h` : `${Math.round(value / 60)}m`
}

/** Evenly spaced y axis ticks (whole units: counts, mL, hours or minutes) from 0 up to a round maximum covering `max`. */
export function computeAxisTicks(id: TrendMetricId, max: number): number[] {
  const unit = getTrendMetric(id)?.valueType === 'duration' ? durationAxisUnit(max) : 1
  const target = max / unit / 4
  const magnitude = target > 0 ? 10 ** Math.floor(Math.log10(target)) : 1
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((m) => m >= target) ?? 1)
  const count = Math.max(1, Math.ceil(max / unit / step))
  return Array.from({ length: count + 1 }, (_, index) => index * step * unit)
}
