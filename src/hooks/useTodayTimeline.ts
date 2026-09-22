import { useEffect, useState } from 'react'
import { subscribeToTodayDiaperEntries } from '../repositories/diaperEntries'
import { subscribeToTodayFeedingEntries } from '../repositories/feedingEntries'
import { subscribeToTodaySleepEntries } from '../repositories/sleepEntries'
import { buildTimeline, type TimelineEntry } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

export function useTodayTimeline(
  householdId: string | null,
  babyId: string | null,
): TimelineEntry[] {
  const [feeding, setFeeding] = useState<FeedingEntry[]>([])
  const [sleep, setSleep] = useState<SleepEntry[]>([])
  const [diaper, setDiaper] = useState<DiaperEntry[]>([])

  useEffect(() => {
    if (!householdId || !babyId) {
      setFeeding([])
      setSleep([])
      setDiaper([])
      return
    }
    const reference = new Date()
    const unsubscribeFeeding = subscribeToTodayFeedingEntries(householdId, babyId, reference, setFeeding)
    const unsubscribeSleep = subscribeToTodaySleepEntries(householdId, babyId, reference, setSleep)
    const unsubscribeDiaper = subscribeToTodayDiaperEntries(householdId, babyId, reference, setDiaper)
    return () => {
      unsubscribeFeeding()
      unsubscribeSleep()
      unsubscribeDiaper()
    }
  }, [householdId, babyId])

  return buildTimeline(feeding, sleep, diaper)
}
