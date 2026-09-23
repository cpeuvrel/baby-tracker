import { formatDuration, formatRelativeTime } from './duration'
import { isToday, isYesterday } from './timeline'
import type {
  DiaperEntry,
  DiaperType,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

const DIAPER_LABELS: Record<DiaperType, string> = { wet: 'Wet', dirty: 'Dirty', both: 'Wet + Dirty', dry: 'Dry' }

export interface PrimarySummary {
  label: string
  meta: string
}

export interface EntryRow {
  title: string
  value?: string
  barFraction?: number
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export function summarizeFeedingPrimary(entry: FeedingEntry, now: Date): PrimarySummary {
  const meta = formatRelativeTime(new Date(entry.occurredAt), now)
  if (entry.type === 'bottle') return { label: 'Last feeding', meta }
  return { label: entry.foodType ? entry.foodType : 'Last meal', meta }
}

export function summarizeSleepPrimary(entry: SleepEntry, now: Date): PrimarySummary {
  if (entry.durationSeconds != null && entry.endedAt != null) {
    return { label: 'Woke up', meta: formatRelativeTime(new Date(entry.endedAt), now) }
  }
  const meta = formatRelativeTime(new Date(entry.startedAt), now)
  return { label: 'Sleeping', meta: `since ${meta}` }
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

export function summarizeFeedingRow(entry: FeedingEntry, maxVolumeMl: number): EntryRow {
  const time = formatClock(entry.occurredAt)
  if (entry.type === 'bottle') {
    const title = `${time} Bottle`
    if (entry.volumeMl == null) return { title }
    return {
      title,
      value: `${entry.volumeMl} mL`,
      barFraction: maxVolumeMl > 0 ? entry.volumeMl / maxVolumeMl : 0,
    }
  }
  return { title: `${time} ${entry.foodType ?? 'Solid'}` }
}

export function summarizeSleepRow(entry: SleepEntry, now: Date, maxDurationSeconds: number): EntryRow {
  const startTime = formatClock(entry.startedAt)
  if (entry.endedAt == null) {
    return { title: `${startTime} Timer running` }
  }

  const prefix = isYesterday(entry.startedAt, now)
    ? 'Yesterday '
    : isToday(entry.startedAt, now)
      ? ''
      : `${formatShortDate(entry.startedAt)} `
  const duration = entry.durationSeconds ?? 0

  return {
    title: `${prefix}${startTime} – ${formatClock(entry.endedAt)}`,
    value: formatDuration(duration),
    barFraction: maxDurationSeconds > 0 ? duration / maxDurationSeconds : 0,
  }
}

export function summarizeDiaperRow(entry: DiaperEntry): EntryRow {
  return { title: `${formatClock(entry.occurredAt)} ${DIAPER_LABELS[entry.type]}` }
}

export function summarizeMedicationRow(entry: MedicationEntry): EntryRow {
  const title = `${formatClock(entry.givenAt)} ${entry.name}`
  return entry.dose ? { title, value: entry.dose } : { title }
}

export function latestGrowthEntryWithField(
  entries: GrowthEntry[],
  field: 'weightG' | 'heightMm' | 'headCircumferenceMm',
): GrowthEntry | undefined {
  return [...entries]
    .filter((entry) => entry[field] != null)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0]
}
