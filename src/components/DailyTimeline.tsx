import { useHousehold } from '../contexts/HouseholdContext'
import { useDayTimeline } from '../hooks/useDayTimeline'
import { formatDuration } from '../lib/duration'
import type { TimelineEntry } from '../lib/timeline'

const DIAPER_LABELS: Record<string, string> = { wet: 'Wet', dirty: 'Dirty', both: 'Wet + Dirty', dry: 'Dry' }

function describeEntry(item: TimelineEntry): string {
  const time = new Date(item.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  switch (item.kind) {
    case 'sleep': {
      const { durationSeconds } = item.entry
      return `${time} — Sleep${durationSeconds != null ? ` (${formatDuration(durationSeconds)})` : ' (in progress)'}`
    }
    case 'feeding': {
      const label = item.entry.type === 'bottle' ? 'Bottle' : 'Solid'
      const detail =
        item.entry.type === 'bottle'
          ? item.entry.volumeMl != null
            ? ` ${item.entry.volumeMl} mL`
            : ''
          : item.entry.foodType
            ? ` (${item.entry.foodType})`
            : ''
      return `${time} — ${label}${detail}`
    }
    case 'diaper':
      return `${time} — Diaper (${DIAPER_LABELS[item.entry.type]})`
  }
}

interface DailyTimelineProps {
  date?: Date
  title?: string
}

export function DailyTimeline({ date, title = 'Today' }: DailyTimelineProps) {
  const { household, selectedBaby } = useHousehold()
  const timeline = useDayTimeline(household?.id ?? null, selectedBaby?.id ?? null, date ?? new Date())

  if (!household || !selectedBaby) return null

  return (
    <section aria-label="Daily log">
      <h2>{title}</h2>
      {timeline.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        <ul>
          {timeline.map((item) => (
            <li key={`${item.kind}-${item.entry.id}`}>{describeEntry(item)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
