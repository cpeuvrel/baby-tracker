import type { PediatricianVisit } from '../types/models'

/** Visits from `today` ("YYYY-MM-DD") on, soonest first (visits come most recent first). */
export function upcomingVisits(visits: PediatricianVisit[], today: string): PediatricianVisit[] {
  return visits.filter((visit) => visit.date >= today).reverse()
}
