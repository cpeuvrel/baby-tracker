import type { DateRange } from '../lib/timeline'
import { subscribeToBathEntriesInRange } from '../repositories/bathEntries'
import { subscribeToDiaperEntriesInRange } from '../repositories/diaperEntries'
import { subscribeToFeedingEntriesInRange } from '../repositories/feedingEntries'
import { subscribeToMedicationEntriesInRange } from '../repositories/medicationEntries'
import { subscribeToSleepEntriesInRange } from '../repositories/sleepEntries'
import type { BathEntry, DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { useSubscriptionState } from './useSubscriptionState'

export interface EntriesInRange {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
  medication: MedicationEntry[]
  bath: BathEntry[]
}

export interface EntriesInRangeState extends EntriesInRange {
  /** True until every collection delivered its first snapshot. */
  loading: boolean
  /** The first listener error: that collection's entries are no longer updated. */
  error: Error | null
}

const NO_ENTRIES: never[] = []

/** The baby's entries of every collection in `range`, with the subscriptions' loading and error state. */
export function useEntriesInRangeState(
  householdId: string | null,
  babyId: string | null,
  range: DateRange,
): EntriesInRangeState {
  const startTime = range.start.getTime()
  const endTime = range.end.getTime()
  const key = householdId && babyId ? `${householdId}/${babyId}/${startTime}/${endTime}` : null
  const effectiveRange = (): DateRange => ({ start: new Date(startTime), end: new Date(endTime) })

  const feeding = useSubscriptionState<FeedingEntry[]>(
    key,
    (onNext, onError) => subscribeToFeedingEntriesInRange(householdId!, babyId!, effectiveRange(), onNext, onError),
    NO_ENTRIES,
  )
  const sleep = useSubscriptionState<SleepEntry[]>(
    key,
    (onNext, onError) => subscribeToSleepEntriesInRange(householdId!, babyId!, effectiveRange(), onNext, onError),
    NO_ENTRIES,
  )
  const diaper = useSubscriptionState<DiaperEntry[]>(
    key,
    (onNext, onError) => subscribeToDiaperEntriesInRange(householdId!, babyId!, effectiveRange(), onNext, onError),
    NO_ENTRIES,
  )
  const medication = useSubscriptionState<MedicationEntry[]>(
    key,
    (onNext, onError) =>
      subscribeToMedicationEntriesInRange(householdId!, babyId!, effectiveRange(), onNext, onError),
    NO_ENTRIES,
  )
  const bath = useSubscriptionState<BathEntry[]>(
    key,
    (onNext, onError) => subscribeToBathEntriesInRange(householdId!, babyId!, effectiveRange(), onNext, onError),
    NO_ENTRIES,
  )

  const states = [feeding, sleep, diaper, medication, bath]
  return {
    feeding: feeding.data,
    sleep: sleep.data,
    diaper: diaper.data,
    medication: medication.data,
    bath: bath.data,
    loading: states.some((state) => state.loading),
    error: states.find((state) => state.error)?.error ?? null,
  }
}

/**
 * The baby's entries of every collection in `range` (empty while loading). The object also
 * carries `loading` and `error`; read them through `useEntriesInRangeState`.
 */
export function useEntriesInRange(
  householdId: string | null,
  babyId: string | null,
  range: DateRange,
): EntriesInRange {
  return useEntriesInRangeState(householdId, babyId, range)
}
