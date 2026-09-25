import { useEffect, useState } from 'react'
import type { DateRange } from '../lib/timeline'
import { subscribeToBathEntriesInRange } from '../repositories/bathEntries'
import { subscribeToDiaperEntriesInRange } from '../repositories/diaperEntries'
import { subscribeToFeedingEntriesInRange } from '../repositories/feedingEntries'
import { subscribeToMedicationEntriesInRange } from '../repositories/medicationEntries'
import { subscribeToSleepEntriesInRange } from '../repositories/sleepEntries'
import type { BathEntry, DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'

export interface EntriesInRange {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
  medication: MedicationEntry[]
  bath: BathEntry[]
}

export function useEntriesInRange(
  householdId: string | null,
  babyId: string | null,
  range: DateRange,
): EntriesInRange {
  const [feeding, setFeeding] = useState<FeedingEntry[]>([])
  const [sleep, setSleep] = useState<SleepEntry[]>([])
  const [diaper, setDiaper] = useState<DiaperEntry[]>([])
  const [medication, setMedication] = useState<MedicationEntry[]>([])
  const [bath, setBath] = useState<BathEntry[]>([])
  const startTime = range.start.getTime()
  const endTime = range.end.getTime()

  useEffect(() => {
    if (!householdId || !babyId) {
      setFeeding([])
      setSleep([])
      setDiaper([])
      setMedication([])
      setBath([])
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
    const unsubscribeMedication = subscribeToMedicationEntriesInRange(
      householdId,
      babyId,
      effectiveRange,
      setMedication,
    )
    const unsubscribeBath = subscribeToBathEntriesInRange(householdId, babyId, effectiveRange, setBath)
    return () => {
      unsubscribeBath()
      unsubscribeFeeding()
      unsubscribeSleep()
      unsubscribeDiaper()
      unsubscribeMedication()
    }
  }, [householdId, babyId, startTime, endTime])

  return { feeding, sleep, diaper, medication, bath }
}
