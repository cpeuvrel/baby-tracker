import { formatDuration } from './duration'
import type { DateRange } from './timeline'
import type { BathEntry, DiaperEntry, DiaperType, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'

export type SummaryRowId = 'bottle' | 'solid' | 'sleep' | 'diaper' | 'bath' | 'medication'

export interface SummaryRow {
  id: SummaryRowId
  title: string
  count: number
  lines: string[]
}

export interface SummaryEntries {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
  medication: MedicationEntry[]
  bath: BathEntry[]
}

const DIAPER_ORDER: { type: DiaperType; label: string }[] = [
  { type: 'wet', label: 'wet' },
  { type: 'dirty', label: 'dirty' },
  { type: 'both', label: 'wet + dirty' },
  { type: 'dry', label: 'dry' },
]

function isInRange(iso: string, range: DateRange): boolean {
  const time = new Date(iso).getTime()
  return time >= range.start.getTime() && time < range.end.getTime()
}

/**
 * A sleep's full length if the baby woke up within `range` (a running sleep: if `now` is in it,
 * counted up to `now`), else 0: sleeps are never split, they count on the day they end.
 */
function sleepSecondsInRange(entry: SleepEntry, range: DateRange, now: Date): number {
  const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now.getTime()
  const endsInRange = entry.endedAt
    ? end >= range.start.getTime() && end < range.end.getTime()
    : end >= range.start.getTime() && end <= range.end.getTime()
  if (!endsInRange) return 0
  return Math.max(0, Math.round((end - new Date(entry.startedAt).getTime()) / 1000))
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)]
}

/**
 * Per-category totals for the Summary sheet. Categories with nothing in the
 * range are left out; sleeps count whole, in the range the baby woke up in.
 */
export function buildActivitySummary(entries: SummaryEntries, range: DateRange, now: Date): SummaryRow[] {
  const rows: SummaryRow[] = []

  const bottles = entries.feeding.filter((entry) => entry.type === 'bottle' && isInRange(entry.occurredAt, range))
  if (bottles.length > 0) {
    const totalMl = bottles.reduce((sum, entry) => sum + (entry.volumeMl ?? 0), 0)
    rows.push({ id: 'bottle', title: 'Bottle Feed', count: bottles.length, lines: [`${totalMl} mL total`] })
  }

  const solids = entries.feeding.filter((entry) => entry.type === 'solid' && isInRange(entry.occurredAt, range))
  if (solids.length > 0) {
    const foods = uniqueValues(solids.map((entry) => entry.foodType).filter((food): food is string => !!food))
    rows.push({ id: 'solid', title: 'Solids', count: solids.length, lines: foods.length > 0 ? [foods.join(', ')] : [] })
  }

  const sleeps = entries.sleep
    .map((entry) => sleepSecondsInRange(entry, range, now))
    .filter((seconds) => seconds > 0)
  if (sleeps.length > 0) {
    const totalSeconds = sleeps.reduce((sum, seconds) => sum + seconds, 0)
    rows.push({
      id: 'sleep',
      title: 'Sleep',
      count: sleeps.length,
      lines: [`${formatDuration(totalSeconds)} total sleep`],
    })
  }

  const diapers = entries.diaper.filter((entry) => isInRange(entry.occurredAt, range))
  if (diapers.length > 0) {
    const counts = DIAPER_ORDER.map(({ type, label }) => ({
      label,
      count: diapers.filter((entry) => entry.type === type).length,
    })).filter(({ count }) => count > 0)
    rows.push({
      id: 'diaper',
      title: 'Diaper',
      count: diapers.length,
      lines: [counts.map(({ label, count }) => `${count} ${label}`).join(', ')],
    })
  }

  const baths = entries.bath.filter((entry) => isInRange(entry.occurredAt, range))
  if (baths.length > 0) {
    rows.push({ id: 'bath', title: 'Bath', count: baths.length, lines: [] })
  }

  const doses = entries.medication.filter((entry) => isInRange(entry.givenAt, range))
  if (doses.length > 0) {
    rows.push({
      id: 'medication',
      title: 'Medication',
      count: doses.length,
      lines: [uniqueValues(doses.map((entry) => entry.name)).join(', ')],
    })
  }

  return rows
}

export interface TodayTotals {
  /** Bottle volume drunk over the range. */
  bottleMl: number
  sleepSeconds: number
  diapers: number
}

/** Headline totals for the recap above the activity cards. */
export function buildTodayTotals(entries: SummaryEntries, range: DateRange, now: Date): TodayTotals {
  return {
    bottleMl: entries.feeding
      .filter((entry) => entry.type === 'bottle' && isInRange(entry.occurredAt, range))
      .reduce((sum, entry) => sum + (entry.volumeMl ?? 0), 0),
    sleepSeconds: entries.sleep.reduce((sum, entry) => sum + sleepSecondsInRange(entry, range, now), 0),
    diapers: entries.diaper.filter((entry) => isInRange(entry.occurredAt, range)).length,
  }
}
