import { addDays, startOfDay, zonedParts, zonedTime } from './appTime'
import { DEFAULT_NIGHTTIME_HOURS, isDuringNight, startsDuringNight, type DailyPoint } from './aggregations'
import { formatDuration } from './duration'
import {
  activityWindowStart,
  CALENDAR_DAYS,
  dayKey,
  nextDayKey,
  nightDayKey,
  type DateRange,
  type DayFrame,
} from './timeline'
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
 * Day an entry counts on: its day of `frame`, calendar days by default (sleeps by their start,
 * as Nara lists them). Per-day values clip sleeps to the frame's days instead (see `sleepSegments`).
 */
export function metricDayKeyOf(frame: DayFrame = CALENDAR_DAYS): (date: string) => string {
  return (date) => frame.keyOf(new Date(date))
}

/**
 * Number of days a `sum` metric's period total is spread over ("per day"): its elapsed part,
 * so the unfinished current day only counts for the hours already gone (at least one day).
 */
export function elapsedPeriodDays(
  dayKeys: string[],
  now: Date = new Date(),
  frame: DayFrame = CALENDAR_DAYS,
): number {
  if (dayKeys.length === 0) return 1
  const start = frame.startOf(dayKeys[0]).getTime()
  const end = frame.startOf(nextDayKey(dayKeys[dayKeys.length - 1])).getTime()
  const elapsed = (Math.min(now.getTime(), end) - start) / (end - start)
  return Math.max(1, elapsed * dayKeys.length)
}

/** Part of a sleep inside one day (of the period's frame) and one side of the night boundary. */
export interface SleepSegment {
  entry: SleepEntry
  start: Date
  end: Date
  /** Day the segment is on. */
  dayKey: string
  /** Whether the segment is inside the baby's nighttime hours. */
  night: boolean
}

/**
 * Cuts sleeps (a running one up to `now`) at the start of every day of `frame` (midnight for
 * calendar days) and at the start / end of the night, so each piece belongs to one day and is
 * entirely daytime or nighttime.
 */
export function sleepSegments(
  entries: SleepEntry[],
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
  now: Date = new Date(),
  frame: DayFrame = CALENDAR_DAYS,
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
        frame.startOf(nextDayKey(dayKey(day))),
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
        dayKey: frame.keyOf(segmentStart),
        night: isDuringNight(segmentStart, nightRange),
      })
    }
  }
  return segments
}

/**
 * Day a completed sleep counts on for Longest Sleep: with calendar days, the morning a night
 * ends (sleep days start at night); with rolling days, the window in which it ends.
 */
function longestSleepDayKey(
  nightRange: NighttimeHours,
  frame: DayFrame,
): (entry: { startedAt: string; endedAt: string }) => string {
  if (frame.kind === 'rolling') return (entry) => frame.keyOf(new Date(entry.endedAt))
  return (entry) => nightDayKey(new Date(entry.startedAt), nightRange.start)
}

/** The longest completed sleep of each day of `dayKeys` (see `longestSleepDayKey`). */
function longestSleeps(
  dayKeys: string[],
  entries: SleepEntry[],
  nightRange: NighttimeHours,
  frame: DayFrame = CALENDAR_DAYS,
): Map<string, SleepEntry> {
  const keyOf = longestSleepDayKey(nightRange, frame)
  const inPeriod = new Set(dayKeys)
  const longest = new Map<string, SleepEntry>()
  for (const entry of completedSleeps(entries)) {
    const key = keyOf(entry)
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
  frame: DayFrame = CALENDAR_DAYS,
): Array<SleepSegment & { inMetric: boolean }> {
  const inPeriod = new Set(dayKeys)
  const longestIds = new Set(
    [...longestSleeps(dayKeys, entries, nightRange, frame).values()].map((entry) => entry.id),
  )
  return sleepSegments(entries, nightRange, now, frame)
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
  frame: DayFrame = CALENDAR_DAYS,
): T {
  const isNight = (date: string) => startsDuringNight(date, nightRange)
  switch (id) {
    case 'sleepDay':
    case 'sleepNight': {
      const segments = sleepSegments(entries.sleep ?? [], nightRange, now, frame)
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
      const kept = new Set(
        [...longestSleeps(dayKeys, entries.sleep ?? [], nightRange, frame).values()].map((entry) => entry.id),
      )
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
  frame: DayFrame,
): Samples {
  const samples = emptySamples(dayKeys)
  const keyOf = metricDayKeyOf(frame)
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
      // Time asleep within each day, split at the night's start and end.
      for (const segment of sleepSegments(entries.sleep, nightRange, now, frame)) {
        if (id === 'sleepDay' && segment.night) continue
        if (id === 'sleepNight' && !segment.night) continue
        addSample(samples, segment.dayKey, (segment.end.getTime() - segment.start.getTime()) / 1000)
      }
      return samples
    case 'sleepLongest':
      for (const [key, entry] of longestSleeps(dayKeys, entries.sleep, nightRange, frame)) {
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
  frame: DayFrame = CALENDAR_DAYS,
): DailyPoint[] {
  const reduce = getTrendMetric(id)?.reducer === 'mean' ? mean : sum
  const samples = metricSamples(id, dayKeys, entries, nightRange, now, frame)
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
  frame: DayFrame = CALENDAR_DAYS,
): number {
  if (getTrendMetric(id)?.reducer === 'mean') {
    return mean([...metricSamples(id, dayKeys, entries, nightRange, now, frame).values()].flat())
  }
  return sum(computeMetricSeries(id, dayKeys, entries, nightRange, now, frame).map((point) => point.value)) /
    elapsedPeriodDays(dayKeys, now, frame)
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
  frame: DayFrame = CALENDAR_DAYS,
): TrendBreakdownItem[] {
  if (dayKeys.length === 0) return []
  switch (id) {
    case 'feedSessions': {
      const inPeriod = new Set(dayKeys)
      const feedings = entries.feeding.filter((entry) => inPeriod.has(frame.keyOf(new Date(entry.occurredAt))))
      return FEEDING_TYPES.map(({ type, label, colorVar }) => ({
        label,
        colorVar,
        value: feedings.filter((entry) => entry.type === type).length / elapsedPeriodDays(dayKeys, now, frame),
      })).filter((item) => item.value > 0)
    }
    case 'feedVolume': {
      const value = computeMetricSummary(id, dayKeys, entries, undefined, now, frame)
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

/** Nighttime hours as shown in the explanations, e.g. "20:00–08:00". */
function formatNightRange(nightRange: NighttimeHours): string {
  return `${nightRange.start}–${nightRange.end}`
}

const PER_DAY = "The period's total is then divided by the number of days elapsed, giving an average per day."

/** Plain-language account of how a metric is calculated, shown on the Trends screens. */
export function describeMetric(id: TrendMetricId, nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS): string {
  const night = formatNightRange(nightRange)
  switch (id) {
    case 'feedSessions':
      return `Every feeding logged (bottles and solids), counted on the day it was logged. ${PER_DAY} The lines underneath split it by feeding type.`
    case 'feedVolume':
      return `The millilitres of every bottle logged with a volume, added up for each day. ${PER_DAY} Solids and bottles without a volume are not counted.`
    case 'feedAvgVolume':
      return 'The size of a single bottle: the millilitres of every bottle logged with a volume during the period, divided by the number of those bottles. Bottles without a volume are left out.'
    case 'feedInterval':
      return 'The time from one feeding (bottle or solids) to the next, between their logged times. Every gap of the period is averaged; a gap counts on the day of the feeding that ends it.'
    case 'diaperCount':
      return `Every diaper change logged, counted on the day of the change. ${PER_DAY}`
    case 'diaperDay':
      return `The diaper changes logged outside the nighttime hours (${night}), counted on the day of the change. ${PER_DAY}`
    case 'diaperNight':
      return `The diaper changes logged during the nighttime hours (${night}), counted on the day of the change. ${PER_DAY}`
    case 'sleepTotal':
      return `All the time asleep, day and night, added up for each day. A sleep that runs past midnight is split between the two days, and a sleep still in progress counts up to now. ${PER_DAY}`
    case 'sleepDay':
      return `Only the time asleep outside the nighttime hours (${night}): a sleep that crosses the start or the end of the night only counts for its daytime part. Added up for each day. ${PER_DAY}`
    case 'sleepNight':
      return `Only the time asleep during the nighttime hours (${night}). A night is split at midnight: the part before midnight counts on the evening's day, the rest on the next day. Added up for each day. ${PER_DAY}`
    case 'sleepLongest':
      return `The longest finished sleep of each day, with its full duration. A sleep starting after ${nightRange.start} counts on the next day, the morning it ends (in rolling 24 h mode, on the 24 hours it ends in). The value shown is the average of these daily longest sleeps, over the days that have one.`
    case 'napCount':
      return `The finished sleeps that start outside the nighttime hours (${night}), counted on the day they start; a nap still in progress is not counted yet. ${PER_DAY}`
    case 'napLength':
      return `The full duration of each finished nap (a sleep starting outside ${night}), averaged over every nap of the period.`
    case 'wakeWindow':
      return 'The time awake between the end of one finished sleep and the start of the next, day and night alike. Every wake window of the period is averaged; one counts on the day the next sleep starts.'
  }
}

/** Rules shared by every metric of the Trends screen: period, "per day" / "average", comparison arrow, nighttime hours. */
export function describeTrendRules(nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS): string[] {
  return [
    '1d is today, since midnight; 7d and 14d are the last 7 or 14 calendar days, today included.',
    '“per day” values are the total over the period divided by the number of days elapsed: today only counts for the hours already gone, so an unfinished day does not pull the average down (1d therefore shows today’s total so far).',
    '“average” values are the mean of every single measurement of the period (each bottle, nap, gap…); days without any are left out.',
    'The coloured arrow is the difference with the previous period of the same length (the day, 7 or 14 days just before).',
    `Daytime and nighttime follow the baby’s nighttime hours (${formatNightRange(nightRange)}), set in Family › Children › the baby › Nighttime Hours.`,
  ]
}
