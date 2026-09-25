import { formatDate, formatTime } from './appTime'
import { formatDuration, formatRelativeTime } from './duration'
import { isToday, isYesterday } from './timeline'
import type {
  BathEntry,
  DiaperEntry,
  DiaperType,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

const DIAPER_LABELS: Record<DiaperType, string> = { wet: 'Wet', dirty: 'Dirty', both: 'Wet + Dirty', dry: 'Dry' }

/** One-word diaper type, shown big next to the last change on the Activity card. */
export const DIAPER_SHORT_LABELS: Record<DiaperType, string> = { wet: 'pee', dirty: 'poo', both: 'mix', dry: 'dry' }

const YESTERDAY_PREFIX = 'YD '

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
  return formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Clock time, prefixed with "YD" when `now` is given and the entry was yesterday. */
function formatRowClock(iso: string, now?: Date): string {
  const prefix = now && isYesterday(iso, now) ? YESTERDAY_PREFIX : ''
  return `${prefix}${formatClock(iso)}`
}

function formatShortDate(iso: string): string {
  return formatDate(new Date(iso), { day: 'numeric', month: 'short' })
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
    label: 'Last change',
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

export function summarizeFeedingRow(entry: FeedingEntry, maxVolumeMl: number, now?: Date): EntryRow {
  const time = formatRowClock(entry.occurredAt, now)
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
    ? YESTERDAY_PREFIX
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

export function summarizeDiaperRow(entry: DiaperEntry, now?: Date): EntryRow {
  return { title: `${formatRowClock(entry.occurredAt, now)} ${DIAPER_LABELS[entry.type]}` }
}

export function summarizeBathRow(entry: BathEntry, now?: Date): EntryRow {
  return { title: `${formatRowClock(entry.occurredAt, now)} Bath` }
}

export function summarizeMedicationRow(entry: MedicationEntry, now?: Date): EntryRow {
  const title = `${formatRowClock(entry.givenAt, now)} ${entry.name}`
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
