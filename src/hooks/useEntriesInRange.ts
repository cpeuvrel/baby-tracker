import { useEffect, useState } from 'react'
import type { DateRange } from '../lib/timeline'
import { subscribeToDiaperEntriesInRange } from '../repositories/diaperEntries'
import { subscribeToFeedingEntriesInRange } from '../repositories/feedingEntries'
import { subscribeToSleepEntriesInRange } from '../repositories/sleepEntries'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

export interface EntriesInRange {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
}

export function useEntriesInRange(
  householdId: string | null,
  babyId: string | null,
  range: DateRange,
): EntriesInRange {
  const [feeding, setFeeding] = useState<FeedingEntry[]>([])
  const [sleep, setSleep] = useState<SleepEntry[]>([])
  const [diaper, setDiaper] = useState<DiaperEntry[]>([])
  const startTime = range.start.getTime()
  const endTime = range.end.getTime()

  useEffect(() => {
    if (!householdId || !babyId) {
      setFeeding([])
      setSleep([])
      setDiaper([])
      return
    }
    const effectiveRange: DateRange = { start: new Date(startTime), end: new Date(endTime) }
    const unsubscribeFeeding = subscribeToFeedingEntriesInRange(
      householdId,
      babyId,
      effectiveRange,
      setFeeding,
    )
    const unsubscribeSleep = subscribeToSleepEntriesInRange(householdId, babyId, effectiveRange, setSleep)
    const unsubscribeDiaper = subscribeToDiaperEntriesInRange(
      householdId,
      babyId,
      effectiveRange,
      setDiaper,
    )
    return () => {
      unsubscribeFeeding()
      unsubscribeSleep()
      unsubscribeDiaper()
    }
  }, [householdId, babyId, startTime, endTime])

  return { feeding, sleep, diaper }
}
