import { addDays } from '../lib/appTime'
import { buildTimeline, dayRange, type DateRange, type TimelineEntry } from '../lib/timeline'
import type { SleepEntry } from '../types/models'
import { useEntriesInRange } from './useEntriesInRange'

export interface DayTimeline {
  /** The day's entries, newest first (a sleep on the day it started). */
  timeline: TimelineEntry[]
  /**
   * Sleeps that started the day before or on the day: with the night that ends on the day,
   * for the day's total sleep (a sleep counts on the day the baby woke up).
   */
  sleep: SleepEntry[]
}

function isInRange(iso: string, range: DateRange): boolean {
  const time = new Date(iso).getTime()
  return time >= range.start.getTime() && time < range.end.getTime()
}

export function useDayTimeline(householdId: string | null, babyId: string | null, referenceDate: Date): DayTimeline {
  const range = dayRange(referenceDate)
  // Loaded from the day before, as the night that ends this morning started then.
  const { feeding, sleep, diaper, medication, bath } = useEntriesInRange(householdId, babyId, {
    start: addDays(range.start, -1),
    end: range.end,
  })
  return {
    timeline: buildTimeline(
      feeding.filter((entry) => isInRange(entry.occurredAt, range)),
      sleep.filter((entry) => isInRange(entry.startedAt, range)),
      diaper.filter((entry) => isInRange(entry.occurredAt, range)),
      medication.filter((entry) => isInRange(entry.givenAt, range)),
      bath.filter((entry) => isInRange(entry.occurredAt, range)),
    ),
    sleep,
  }
}
