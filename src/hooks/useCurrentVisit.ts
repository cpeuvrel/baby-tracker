import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { VISIT_BABY_PARAM } from '../lib/vaccineNotification'
import { usePediatricianVisits } from './usePediatricianVisits'

/**
 * The visit named by the `:visitId` route param, looked up in the selected baby's visits.
 * `visit` is `undefined` while loading and `null` when the selected baby has no such visit
 * (e.g. another child was picked in the header).
 * A `?baby=` param (links from notifications) selects that child first.
 */
export function useCurrentVisit() {
  const { visitId } = useParams<{ visitId: string }>()
  const [searchParams] = useSearchParams()
  const { household, babies, selectedBaby, selectBaby } = useHousehold()
  const visits = usePediatricianVisits(household?.id ?? null, selectedBaby?.id ?? null)

  const wantedBabyId = searchParams.get(VISIT_BABY_PARAM)
  const switching =
    wantedBabyId != null && wantedBabyId !== selectedBaby?.id && babies.some((baby) => baby.id === wantedBabyId)
  useEffect(() => {
    if (switching) selectBaby(wantedBabyId)
  }, [switching, wantedBabyId, selectBaby])

  const visit =
    visits === null || switching ? undefined : (visits.find((candidate) => candidate.id === visitId) ?? null)
  return { household, baby: selectedBaby, visit }
}
