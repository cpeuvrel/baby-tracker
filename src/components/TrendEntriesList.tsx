import { useEffect, useRef, type ReactNode } from 'react'
import { formatDate, formatTime } from '../lib/appTime'
import { formatDuration } from '../lib/duration'
import { dayKey, parseDayKey } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { DiaperIcon, FeedIcon, SleepIcon } from './icons'

type TrendEntriesListProps = {
  colorVar: string
  /** Day (from the Graph view) to scroll to and highlight. */
  focusDayKey?: string | null
  /** Day an entry is listed under (calendar day by default; sleep days start at night). */
  dayKeyOf?: (iso: string) => string
} & (
  | { kind: 'feeding'; entries: FeedingEntry[]; onSelect: (entry: FeedingEntry) => void }
  | { kind: 'sleep'; entries: SleepEntry[]; onSelect: (entry: SleepEntry) => void }
  | { kind: 'diaper'; entries: DiaperEntry[]; onSelect: (entry: DiaperEntry) => void }
)

interface ListItem {
  id: string
  at: string
  label: string
  value?: string
  barFraction?: number
  onClick: () => void
}

const DIAPER_LABELS: Record<DiaperEntry['type'], string> = {
  wet: 'Wet',
  dirty: 'Dirty',
  both: 'Wet + Dirty',
  dry: 'Dry',
}

function formatClock(iso: string): string {
  return formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit' }, 'en-GB')
}

function formatDayHeading(key: string): string {
  return formatDate(parseDayKey(key), { month: 'short', day: 'numeric', year: 'numeric' })
}

function fraction(value: number, max: number): number {
  return max > 0 ? value / max : 0
}

function toItems(props: TrendEntriesListProps): ListItem[] {
  switch (props.kind) {
    case 'feeding': {
      const max = Math.max(0, ...props.entries.map((entry) => entry.volumeMl ?? 0))
      return props.entries.map((entry) => ({
        id: entry.id,
        at: entry.occurredAt,
        label: entry.type === 'bottle' ? 'Bottle' : (entry.foodType ?? 'Solid'),
        ...(entry.type === 'bottle' && entry.volumeMl != null
          ? { value: `${entry.volumeMl} mL`, barFraction: fraction(entry.volumeMl, max) }
          : {}),
        onClick: () => props.onSelect(entry),
      }))
    }
    case 'sleep': {
      const max = Math.max(0, ...props.entries.map((entry) => entry.durationSeconds ?? 0))
      return props.entries.map((entry) => ({
        id: entry.id,
        at: entry.startedAt,
        ...(entry.endedAt == null
          ? { label: 'Sleeping', value: 'In progress' }
          : {
              label: `– ${formatClock(entry.endedAt)}`,
              value: formatDuration(entry.durationSeconds ?? 0),
              barFraction: fraction(entry.durationSeconds ?? 0, max),
            }),
        onClick: () => props.onSelect(entry),
      }))
    }
    case 'diaper':
      return props.entries.map((entry) => ({
        id: entry.id,
        at: entry.occurredAt,
        label: DIAPER_LABELS[entry.type],
        onClick: () => props.onSelect(entry),
      }))
  }
}

const ICONS: Record<TrendEntriesListProps['kind'], () => ReactNode> = {
  feeding: () => <FeedIcon />,
  sleep: () => <SleepIcon />,
  diaper: () => <DiaperIcon />,
}

/** Entries of a trend metric, newest first, grouped under one heading per day. */
export function TrendEntriesList(props: TrendEntriesListProps) {
  const focusRef = useRef<HTMLElement>(null)
  const { focusDayKey } = props
  const dayKeyOf = props.dayKeyOf ?? ((iso: string) => dayKey(new Date(iso)))

  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: 'start' })
  }, [focusDayKey])

  const items = toItems(props).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  if (items.length === 0 && !focusDayKey) return <p className="trend-entries-empty">No entries for this period</p>

  const groups: { key: string; items: ListItem[] }[] = []
  for (const item of items) {
    const key = dayKeyOf(item.at)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  if (focusDayKey && !groups.some((group) => group.key === focusDayKey)) {
    groups.push({ key: focusDayKey, items: [] })
    groups.sort((a, b) => b.key.localeCompare(a.key))
  }

  const color = `var(${props.colorVar})`

  return (
    <div className="trend-entries">
      {groups.map((group) => (
        <section
          key={group.key}
          ref={group.key === focusDayKey ? focusRef : undefined}
          aria-label={formatDayHeading(group.key)}
        >
          <h3 className={`trend-entries-day${group.key === focusDayKey ? ' is-focused' : ''}`}>
            {formatDayHeading(group.key)}
          </h3>
          {group.items.length === 0 && <p className="trend-entries-empty">No entries this day</p>}
          <ul>
            {group.items.map((item) => {
              return (
                <li key={item.id}>
                  <button type="button" className="trend-entry-row" onClick={item.onClick}>
                    <span className="trend-entry-icon" style={{ color }}>
                      {ICONS[props.kind]()}
                    </span>
                    <span className="trend-entry-body">
                      <span className="trend-entry-title">
                        <span className="trend-entry-time">{formatClock(item.at)}</span> {item.label}
                      </span>
                      {item.value != null && (
                        <span className="trend-entry-meta">
                          {item.barFraction != null && (
                            <span
                              className="trend-entry-bar"
                              style={{ width: `${Math.max(Math.min(item.barFraction, 1), 0.08) * 70}%`, background: color }}
                            />
                          )}
                          <span className="trend-entry-value">{item.value}</span>
                        </span>
                      )}
                    </span>
                    <span className="trend-entry-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
