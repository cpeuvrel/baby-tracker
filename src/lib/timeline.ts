import { addDays, startOfDay, zonedParts, zonedTime } from './appTime'
import type { BathEntry, DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'

export interface DateRange {
  start: Date
  end: Date
}

/** The Paris calendar day containing `reference`. */
export function dayRange(reference: Date): DateRange {
  const start = startOfDay(reference)
  return { start, end: addDays(start, 1) }
}

export function lastNDaysRange(reference: Date, days: number): DateRange {
  const { end } = dayRange(reference)
  return { start: addDays(end, -days), end }
}

/** `YYYY-MM-DD` of the Paris calendar day containing `date`. */
export function dayKey(date: Date): string {
  const { year, month, day } = zonedParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Paris midnight starting the day `key` (`YYYY-MM-DD`). */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return zonedTime(year, month, day)
}

/** Day of the month of a `YYYY-MM-DD` key. */
export function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10))
}

/** Key of the calendar day after `key`. */
export function nextDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return dayKey(zonedTime(year, month, day + 1, 12))
}

/**
 * How a trend period's instants are grouped into days: Paris calendar days (00:00 → 24:00),
 * or rolling 24-hour windows ending at a given time of day, each keyed by the day it ends on.
 */
export interface DayFrame {
  kind: 'calendar' | 'rolling'
  /** Seconds after Paris midnight at which each day of the frame starts (0 for calendar days). */
  startSeconds: number
  /** Key of the day of the frame containing `date`. */
  keyOf: (date: Date) => string
  /** Instant at which the day `key` of the frame starts. */
  startOf: (key: string) => Date
}

export const CALENDAR_DAYS: DayFrame = {
  kind: 'calendar',
  startSeconds: 0,
  keyOf: dayKey,
  startOf: parseDayKey,
}

/**
 * Rolling 24-hour windows ending at `end`'s time of day: the window keyed by today is the last
 * 24 hours up to `end`, the one keyed by yesterday the 24 hours before, and so on.
 */
export function rollingDayFrame(end: Date): DayFrame {
  const { hour, minute, second } = zonedParts(end)
  const startOf = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return zonedTime(year, month, day - 1, hour, minute, second)
  }
  return {
    kind: 'rolling',
    startSeconds: hour * 3600 + minute * 60 + second,
    keyOf: (date) => {
      const key = dayKey(date)
      const next = nextDayKey(key)
      return date.getTime() >= startOf(next).getTime() ? next : key
    },
    startOf,
  }
}

/** The `days` days of `frame` ending with the day `endKey`, and the time they cover. */
export function framePeriod(frame: DayFrame, endKey: string, days: number): { range: DateRange; dayKeys: string[] } {
  const dayKeys = [endKey]
  for (let index = 1; index < days; index += 1) {
    dayKeys.unshift(dayKey(addDays(parseDayKey(dayKeys[0]), -1)))
  }
  return { range: { start: frame.startOf(dayKeys[0]), end: frame.startOf(nextDayKey(endKey)) }, dayKeys }
}

/**
 * Start of the Activity cards' window: yesterday at the start of the baby's
 * night (e.g. 20:00), so last night's sleep and feeds still show today.
 */
export function activityWindowStart(now: Date, nightStart: string): Date {
  const { year, month, day } = zonedParts(now)
  const [hour, minute] = nightStart.split(':').map(Number)
  return zonedTime(year, month, day - 1, hour, minute)
}

/**
 * Key of the "night day" containing `date`: a day that starts at the beginning of the
 * previous night (e.g. 20:00 the day before) and ends when that day's night begins,
 * so a night's sleep counts on the morning it ends, with the naps that follow.
 */
export function nightDayKey(date: Date, nightStart: string): string {
  const { year, month, day, hour, minute } = zonedParts(date)
  const [startHour, startMinute] = nightStart.split(':').map(Number)
  const afterNightStart = hour * 60 + minute >= startHour * 60 + startMinute
  return afterNightStart ? dayKey(zonedTime(year, month, day + 1, 12)) : dayKey(date)
}

export function isToday(iso: string, now: Date): boolean {
  return dayKey(new Date(iso)) === dayKey(now)
}

export function isYesterday(iso: string, now: Date): boolean {
  return dayKey(new Date(iso)) === dayKey(addDays(now, -1))
}

export function lastNDayKeys(reference: Date, days: number): string[] {
  const keys: string[] = []
  const today = startOfDay(reference)
  for (let i = days - 1; i >= 0; i -= 1) keys.push(dayKey(addDays(today, -i)))
  return keys
}

/** Day keys for every calendar day touched by [range.start, range.end). */
export function dayKeysInRange(range: DateRange): string[] {
  const keys: string[] = []
  for (let cursor = startOfDay(range.start); cursor.getTime() < range.end.getTime(); cursor = addDays(cursor, 1)) {
    keys.push(dayKey(cursor))
  }
  return keys
}

/** The range immediately preceding `range`, of the same length. */
export function precedingRange(range: DateRange): DateRange {
  const length = range.end.getTime() - range.start.getTime()
  return { start: new Date(range.start.getTime() - length), end: new Date(range.start) }
}

export type TimelineEntry =
  | { kind: 'feeding'; at: string; entry: FeedingEntry }
  | { kind: 'sleep'; at: string; entry: SleepEntry }
  | { kind: 'diaper'; at: string; entry: DiaperEntry }
  | { kind: 'medication'; at: string; entry: MedicationEntry }
  | { kind: 'bath'; at: string; entry: BathEntry }

export function buildTimeline(
  feedingEntries: FeedingEntry[],
  sleepEntries: SleepEntry[],
  diaperEntries: DiaperEntry[],
  medicationEntries: MedicationEntry[] = [],
  bathEntries: BathEntry[] = [],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...feedingEntries.map((entry): TimelineEntry => ({ kind: 'feeding', at: entry.occurredAt, entry })),
    ...sleepEntries.map((entry): TimelineEntry => ({ kind: 'sleep', at: entry.startedAt, entry })),
    ...diaperEntries.map((entry): TimelineEntry => ({ kind: 'diaper', at: entry.occurredAt, entry })),
    ...medicationEntries.map((entry): TimelineEntry => ({ kind: 'medication', at: entry.givenAt, entry })),
    ...bathEntries.map((entry): TimelineEntry => ({ kind: 'bath', at: entry.occurredAt, entry })),
  ]

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
