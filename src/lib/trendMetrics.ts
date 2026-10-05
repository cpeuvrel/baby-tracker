import { addDays, startOfDay, zonedParts, zonedTime } from './appTime'
import { DEFAULT_NIGHTTIME_HOURS, isDuringNight, startsDuringNight, type DailyPoint } from './aggregations'
import { formatDuration } from './duration'
import { activityWindowStart, dayKey, nightDayKey, parseDayKey, type DateRange } from './timeline'
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
 * Day an entry is listed under: its calendar day (sleeps by their start, as Nara lists them).
 * Per-day values clip sleeps to calendar days instead (see `sleepSegments`).
 */
export function metricDayKeyOf(): (date: string) => string {
  return (date) => dayKey(new Date(date))
}

/**
 * Number of days a `sum` metric's period total is spread over ("per day"): its elapsed part,
 * so the unfinished current day only counts for the hours already gone (at least one day).
 */
export function elapsedPeriodDays(dayKeys: string[], now: Date = new Date()): number {
  if (dayKeys.length === 0) return 1
  const start = parseDayKey(dayKeys[0]).getTime()
  const end = addDays(parseDayKey(dayKeys[dayKeys.length - 1]), 1).getTime()
  const elapsed = (Math.min(now.getTime(), end) - start) / (end - start)
  return Math.max(1, elapsed * dayKeys.length)
}

/** Part of a sleep inside one calendar day and one side of the night boundary. */
export interface SleepSegment {
  entry: SleepEntry
  start: Date
  end: Date
  /** Calendar day the segment is on. */
  dayKey: string
  /** Whether the segment is inside the baby's nighttime hours. */
  night: boolean
}

/**
 * Cuts sleeps (a running one up to `now`) at every midnight and at the start / end of the
 * night, so each piece belongs to one calendar day and is entirely daytime or nighttime.
 */
export function sleepSegments(
  entries: SleepEntry[],
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
  now: Date = new Date(),
): SleepSegment[] {
  const [nightStartHour, nightStartMinute] = nightRange.start.split(':').map(Number)
  const [nightEndHour, nightEndMinute] = nightRange.end.split(':').map(Number)
  const segments: SleepSegment[] = []
  for (const entry of entries) {
    const start = new Date(entry.startedAt)
    const end = entry.endedAt ? new Date(entry.endedAt) : now
    if (end.getTime() <= start.getTime()) continue
    const cuts = new Set<number>([start.getTime(), end.getTime()])
    for (let day = startOfDay(start); day.getTime() < end.getTime(); day = addDays(day, 1)) {
      const { year, month, day: date } = zonedParts(day)
      for (const cut of [
        zonedTime(year, month, date + 1),
        zonedTime(year, month, date, nightStartHour, nightStartMinute),
        zonedTime(year, month, date, nightEndHour, nightEndMinute),
      ]) {
        if (cut.getTime() > start.getTime() && cut.getTime() < end.getTime()) cuts.add(cut.getTime())
      }
    }
    const sorted = [...cuts].sort((a, b) => a - b)
    for (let index = 1; index < sorted.length; index += 1) {
      const segmentStart = new Date(sorted[index - 1])
      const segmentEnd = new Date(sorted[index])
      segments.push({
        entry,
        start: segmentStart,
        end: segmentEnd,
        dayKey: dayKey(segmentStart),
        night: isDuringNight(segmentStart, nightRange),
      })
    }
  }
  return segments
}

/** Day a sleep counts on for Longest Sleep: the morning a night ends (sleep days start at night). */
function longestSleepDayKey(nightRange: NighttimeHours): (date: string) => string {
  return (date) => nightDayKey(new Date(date), nightRange.start)
}

/** The longest completed sleep of each day of `dayKeys` (by the morning it ends). */
function longestSleeps(dayKeys: string[], entries: SleepEntry[], nightRange: NighttimeHours): Map<string, SleepEntry> {
  const keyOf = longestSleepDayKey(nightRange)
  const inPeriod = new Set(dayKeys)
  const longest = new Map<string, SleepEntry>()
  for (const entry of completedSleeps(entries)) {
    const key = keyOf(entry.startedAt)
    if (!inPeriod.has(key)) continue
    const current = longest.get(key)
    if (!current || (current.durationSeconds ?? 0) < entry.durationSeconds) longest.set(key, entry)
  }
  return longest
}

/**
 * Whether a piece of sleep is part of the metric: the Calendar view draws it in full colour,
 * the rest of the baby's sleep faded.
 */
export function sleepSegmentInMetric(
  id: TrendMetricId,
  segment: SleepSegment,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
  longestIds: Set<string> = new Set(),
): boolean {
  switch (id) {
    case 'sleepDay':
      return !segment.night
    case 'sleepNight':
      return segment.night
    case 'napCount':
    case 'napLength':
      return !startsDuringNight(segment.entry.startedAt, nightRange)
    case 'sleepLongest':
      return longestIds.has(segment.entry.id)
    default:
      return true
  }
}

/** Every piece of the period's sleep, flagged as part of the metric or not. */
export function metricSleepSegments(
  id: TrendMetricId,
  dayKeys: string[],
  entries: SleepEntry[],
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
  now: Date = new Date(),
): Array<SleepSegment & { inMetric: boolean }> {
  const inPeriod = new Set(dayKeys)
  const longestIds = new Set([...longestSleeps(dayKeys, entries, nightRange).values()].map((entry) => entry.id))
  return sleepSegments(entries, nightRange, now)
    .filter((segment) => inPeriod.has(segment.dayKey))
    .map((segment) => ({ ...segment, inMetric: sleepSegmentInMetric(id, segment, nightRange, longestIds) }))
}

/** Range to load for a period of calendar days: from the start of the night before, so its first sleep day is complete. */
export function trendFetchRange(range: DateRange, nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS): DateRange {
  return { start: activityWindowStart(range.start, nightRange.start), end: range.end }
}

/**
 * Keeps only the entries that make up the metric (the others are left as they are): the
 * daytime / nighttime diapers, the sleeps with a part counted by the metric, or each day's longest sleep.
 */
export function filterMetricEntries<T extends Partial<TrendEntriesBundle>>(
  id: TrendMetricId,
  entries: T,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
  dayKeys?: string[],
  now: Date = new Date(),
): T {
  const isNight = (date: string) => startsDuringNight(date, nightRange)
  switch (id) {
    case 'sleepDay':
    case 'sleepNight': {
      const segments = sleepSegments(entries.sleep ?? [], nightRange, now)
      const inPeriod = dayKeys ? new Set(dayKeys) : null
      const kept = new Set(
        segments
          .filter((segment) => (id === 'sleepNight') === segment.night)
          .filter((segment) => !inPeriod || inPeriod.has(segment.dayKey))
          .map((segment) => segment.entry.id),
      )
      return { ...entries, sleep: entries.sleep?.filter((entry) => kept.has(entry.id)) }
    }
    case 'napCount':
    case 'napLength':
      return { ...entries, sleep: entries.sleep?.filter((entry) => !isNight(entry.startedAt)) }
    case 'sleepLongest': {
      if (!dayKeys) return entries
      const kept = new Set([...longestSleeps(dayKeys, entries.sleep ?? [], nightRange).values()].map((entry) => entry.id))
      return { ...entries, sleep: entries.sleep?.filter((entry) => kept.has(entry.id)) }
    }
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
  now: Date,
): Samples {
  const samples = emptySamples(dayKeys)
  const keyOf = metricDayKeyOf()
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
      // Time asleep within each calendar day, split at the night's start and end.
      for (const segment of sleepSegments(entries.sleep, nightRange, now)) {
        if (id === 'sleepDay' && segment.night) continue
        if (id === 'sleepNight' && !segment.night) continue
        addSample(samples, segment.dayKey, (segment.end.getTime() - segment.start.getTime()) / 1000)
      }
      return samples
    case 'sleepLongest':
      for (const [key, entry] of longestSleeps(dayKeys, entries.sleep, nightRange)) {
        addSample(samples, key, entry.durationSeconds ?? 0)
      }
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
  now: Date = new Date(),
): DailyPoint[] {
  const reduce = getTrendMetric(id)?.reducer === 'mean' ? mean : sum
  const samples = metricSamples(id, dayKeys, entries, nightRange, now)
  return dayKeys.map((key) => ({ dayKey: key, value: reduce(samples.get(key) ?? []) }))
}

/**
 * The period's headline value: the per-day average of a `sum` metric (its total over the
 * period's elapsed days, see `elapsedPeriodDays`), or the mean of every sample of a `mean`
 * metric (days without any don't count).
 */
export function computeMetricSummary(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
  now: Date = new Date(),
): number {
  if (getTrendMetric(id)?.reducer === 'mean') {
    return mean([...metricSamples(id, dayKeys, entries, nightRange, now).values()].flat())
  }
  return sum(computeMetricSeries(id, dayKeys, entries, nightRange, now).map((point) => point.value)) /
    elapsedPeriodDays(dayKeys, now)
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
  now: Date = new Date(),
): TrendBreakdownItem[] {
  if (dayKeys.length === 0) return []
  switch (id) {
    case 'feedSessions': {
      const inPeriod = new Set(dayKeys)
      const feedings = entries.feeding.filter((entry) => inPeriod.has(dayKey(new Date(entry.occurredAt))))
      return FEEDING_TYPES.map(({ type, label, colorVar }) => ({
        label,
        colorVar,
        value: feedings.filter((entry) => entry.type === type).length / elapsedPeriodDays(dayKeys, now),
      })).filter((item) => item.value > 0)
    }
    case 'feedVolume': {
      const value = computeMetricSummary(id, dayKeys, entries, undefined, now)
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
