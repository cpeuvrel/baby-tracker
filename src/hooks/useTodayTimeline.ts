import { buildTimeline, dayRange, type TimelineEntry } from '../lib/timeline'
import { useEntriesInRange } from './useEntriesInRange'

export function useTodayTimeline(
  householdId: string | null,
  babyId: string | null,
): TimelineEntry[] {
  const { feeding, sleep, diaper } = useEntriesInRange(householdId, babyId, dayRange(new Date()))
  return buildTimeline(feeding, sleep, diaper)
}
