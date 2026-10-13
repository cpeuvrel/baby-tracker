import { subscribeToPediatricianVisits } from '../repositories/pediatricianVisits'
import type { PediatricianVisit } from '../types/models'
import { useSubscriptionState } from './useSubscriptionState'

export interface PediatricianVisitsState {
  /** Most recent first; `null` until the first snapshot (or after an error before any). */
  visits: PediatricianVisit[] | null
  loading: boolean
  error: Error | null
}

const NO_VISITS: PediatricianVisit[] = []

/** The baby's visits, with the subscription's loading and error state. */
export function usePediatricianVisitsState(
  householdId: string | null,
  babyId: string | null,
): PediatricianVisitsState {
  const key = householdId && babyId ? `${householdId}/${babyId}` : null
  const { data, loading, error } = useSubscriptionState<PediatricianVisit[] | null>(
    key,
    (onNext, onError) => subscribeToPediatricianVisits(householdId!, babyId!, onNext, onError),
    null,
  )
  if (key === null) return { visits: NO_VISITS, loading: false, error: null }
  return { visits: data, loading, error }
}

/** The baby's visits, most recent first; `null` until the first snapshot arrives. */
export function usePediatricianVisits(
  householdId: string | null,
  babyId: string | null,
): PediatricianVisit[] | null {
  return usePediatricianVisitsState(householdId, babyId).visits
}
