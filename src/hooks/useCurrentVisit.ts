import { useParams } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisits } from './usePediatricianVisits'

/**
 * The visit named by the `:visitId` route param, looked up in the selected baby's visits.
 * `visit` is `undefined` while loading and `null` when the selected baby has no such visit
 * (e.g. another child was picked in the header).
 */
export function useCurrentVisit() {
  const { visitId } = useParams<{ visitId: string }>()
  const { household, selectedBaby } = useHousehold()
  const visits = usePediatricianVisits(household?.id ?? null, selectedBaby?.id ?? null)
  const visit = visits === null ? undefined : (visits.find((candidate) => candidate.id === visitId) ?? null)
  return { household, baby: selectedBaby, visit }
}
