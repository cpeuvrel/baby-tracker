import { addDays, startOfDay, zonedParts, zonedTime } from './appTime'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'

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

/**
 * Start of the Activity cards' window: yesterday at the start of the baby's
 * night (e.g. 20:00), so last night's sleep and feeds still show today.
 */
export function activityWindowStart(now: Date, nightStart: string): Date {
  const { year, month, day } = zonedParts(now)
  const [hour, minute] = nightStart.split(':').map(Number)
  return zonedTime(year, month, day - 1, hour, minute)
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

export function buildTimeline(
  feedingEntries: FeedingEntry[],
  sleepEntries: SleepEntry[],
  diaperEntries: DiaperEntry[],
  medicationEntries: MedicationEntry[] = [],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...feedingEntries.map((entry): TimelineEntry => ({ kind: 'feeding', at: entry.occurredAt, entry })),
    ...sleepEntries.map((entry): TimelineEntry => ({ kind: 'sleep', at: entry.startedAt, entry })),
    ...diaperEntries.map((entry): TimelineEntry => ({ kind: 'diaper', at: entry.occurredAt, entry })),
    ...medicationEntries.map((entry): TimelineEntry => ({ kind: 'medication', at: entry.givenAt, entry })),
  ]

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
