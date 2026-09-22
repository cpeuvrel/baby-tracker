import { formatDuration, formatRelativeTime } from './duration'
import type {
  DiaperEntry,
  DiaperType,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

const DIAPER_LABELS: Record<DiaperType, string> = { pee: 'Pipi', poop: 'Caca', both: 'Pipi + caca' }

export interface PrimarySummary {
  label: string
  meta: string
}

export function summarizeFeedingEntry(entry: FeedingEntry, now: Date): string {
  const relative = formatRelativeTime(new Date(entry.occurredAt), now)
  if (entry.type === 'bottle') {
    return entry.volumeMl != null ? `${entry.volumeMl} mL — ${relative}` : relative
  }
  return entry.foodType ? `${entry.foodType} — ${relative}` : relative
}

export function summarizeSleepEntry(entry: SleepEntry, now: Date): string {
  if (entry.durationSeconds != null) {
    return `${formatDuration(entry.durationSeconds)} — ${formatRelativeTime(new Date(entry.startedAt), now)}`
  }
  return `En cours depuis ${formatRelativeTime(new Date(entry.startedAt), now)}`
}

export function summarizeDiaperEntry(entry: DiaperEntry, now: Date): string {
  return `${DIAPER_LABELS[entry.type]} — ${formatRelativeTime(new Date(entry.occurredAt), now)}`
}

export function summarizeMedicationEntry(entry: MedicationEntry, now: Date): string {
  const relative = formatRelativeTime(new Date(entry.givenAt), now)
  return entry.dose ? `${entry.name} — ${entry.dose} — ${relative}` : `${entry.name} — ${relative}`
}

export function summarizeGrowthEntry(entry: GrowthEntry, now: Date): string {
  const parts: string[] = []
  if (entry.weightG != null) parts.push(`${(entry.weightG / 1000).toFixed(2)} kg`)
  if (entry.heightMm != null) parts.push(`${(entry.heightMm / 10).toFixed(1)} cm`)
  const measure = parts.length > 0 ? parts.join(' · ') : 'Mesure'
  return `${measure} — ${formatRelativeTime(new Date(entry.measuredAt), now)}`
}

export function summarizeFeedingPrimary(entry: FeedingEntry, now: Date): PrimarySummary {
  const meta = formatRelativeTime(new Date(entry.occurredAt), now)
  if (entry.type === 'bottle') return { label: 'Dernier biberon', meta }
  return { label: entry.foodType ? entry.foodType : 'Dernier repas', meta }
}

export function summarizeSleepPrimary(entry: SleepEntry, now: Date): PrimarySummary {
  const meta = formatRelativeTime(new Date(entry.startedAt), now)
  if (entry.durationSeconds != null) return { label: 'Réveillé', meta }
  return { label: 'En cours', meta: `depuis ${meta}` }
}

export function summarizeDiaperPrimary(entry: DiaperEntry, now: Date): PrimarySummary {
  return {
    label: DIAPER_LABELS[entry.type],
    meta: formatRelativeTime(new Date(entry.occurredAt), now),
  }
}

export function summarizeMedicationPrimary(entry: MedicationEntry, now: Date): PrimarySummary {
  return {
    label: entry.name,
    meta: entry.dose
      ? `${entry.dose} — ${formatRelativeTime(new Date(entry.givenAt), now)}`
      : formatRelativeTime(new Date(entry.givenAt), now),
  }
}

export function summarizeGrowthPrimary(entry: GrowthEntry, now: Date): PrimarySummary {
  const parts: string[] = []
  if (entry.weightG != null) parts.push(`${(entry.weightG / 1000).toFixed(2)} kg`)
  if (entry.heightMm != null) parts.push(`${(entry.heightMm / 10).toFixed(1)} cm`)
  return {
    label: parts.length > 0 ? parts.join(' · ') : 'Mesure',
    meta: formatRelativeTime(new Date(entry.measuredAt), now),
  }
}
