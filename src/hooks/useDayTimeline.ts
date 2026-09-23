import { buildTimeline, dayRange, type TimelineEntry } from '../lib/timeline'
import { useEntriesInRange } from './useEntriesInRange'

export function useDayTimeline(
  householdId: string | null,
  babyId: string | null,
  referenceDate: Date,
): TimelineEntry[] {
  const { feeding, sleep, diaper } = useEntriesInRange(householdId, babyId, dayRange(referenceDate))
  return buildTimeline(feeding, sleep, diaper)
}
