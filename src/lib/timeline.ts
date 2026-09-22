import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

export function dayRange(reference: Date): { start: Date; end: Date } {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
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
    ...feedingEntries.map((entry): TimelineEntry => ({ kind: 'feeding', at: entry.startedAt, entry })),
    ...sleepEntries.map((entry): TimelineEntry => ({ kind: 'sleep', at: entry.startedAt, entry })),
    ...diaperEntries.map((entry): TimelineEntry => ({ kind: 'diaper', at: entry.occurredAt, entry })),
  ]

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
