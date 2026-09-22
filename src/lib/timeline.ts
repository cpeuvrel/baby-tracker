import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

export interface DateRange {
  start: Date
  end: Date
}

export function dayRange(reference: Date): DateRange {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export function lastNDaysRange(reference: Date, days: number): DateRange {
  const { end } = dayRange(reference)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { start, end }
}

export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function lastNDayKeys(reference: Date, days: number): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(reference)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - i)
    keys.push(dayKey(day))
  }
  return keys
}

export type TimelineEntry =
  | { kind: 'feeding'; at: string; entry: FeedingEntry }
  | { kind: 'sleep'; at: string; entry: SleepEntry }
  | { kind: 'diaper'; at: string; entry: DiaperEntry }

export function buildTimeline(
  feedingEntries: FeedingEntry[],
  sleepEntries: SleepEntry[],
  diaperEntries: DiaperEntry[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...feedingEntries.map((entry): TimelineEntry => ({ kind: 'feeding', at: entry.occurredAt, entry })),
    ...sleepEntries.map((entry): TimelineEntry => ({ kind: 'sleep', at: entry.startedAt, entry })),
    ...diaperEntries.map((entry): TimelineEntry => ({ kind: 'diaper', at: entry.occurredAt, entry })),
  ]

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
