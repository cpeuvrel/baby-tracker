import { useEffect, useState } from 'react'
import { subscribeToPediatricianVisits } from '../repositories/pediatricianVisits'
import type { PediatricianVisit } from '../types/models'

/** The baby's visits, most recent first; `null` until the first snapshot arrives. */
export function usePediatricianVisits(
  householdId: string | null,
  babyId: string | null,
): PediatricianVisit[] | null {
  const [visits, setVisits] = useState<{ key: string; visits: PediatricianVisit[] } | null>(null)
  const key = `${householdId}/${babyId}`

  useEffect(() => {
    if (!householdId || !babyId) return
    return subscribeToPediatricianVisits(householdId, babyId, (next) => setVisits({ key, visits: next }))
  }, [householdId, babyId, key])

  if (!householdId || !babyId) return []
  // Ignore the previous baby's visits while the new subscription loads.
  return visits?.key === key ? visits.visits : null
}
