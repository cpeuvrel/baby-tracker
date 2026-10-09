import { useHousehold } from '../contexts/HouseholdContext'
import { useActivityVisibility } from '../hooks/useActivityVisibility'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { buildTodayTotals } from '../lib/activitySummary'
import { addDays } from '../lib/appTime'
import { formatDuration } from '../lib/duration'
import { dayRange } from '../lib/timeline'

/** Today's feeds, sleep and diapers at a glance, above the activity cards. */
export function TodayRecap({ now }: { now: Date }) {
  const { household, selectedBaby } = useHousehold()
  const { isVisible } = useActivityVisibility()
  const range = dayRange(now)
  // Sleeps are queried by start time: look back a day to catch last night's.
  const queryRange = { start: addDays(range.start, -1), end: range.end }
  const entries = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, queryRange)
  const totals = buildTodayTotals(entries, range, now)

  const items = [
    isVisible('feeding') && { label: totals.feeds === 1 ? 'feed' : 'feeds', value: String(totals.feeds) },
    isVisible('sleep') && { label: 'sleep', value: formatDuration(totals.sleepSeconds) },
    isVisible('diaper') && { label: totals.diapers === 1 ? 'diaper' : 'diapers', value: String(totals.diapers) },
  ].filter((item): item is { label: string; value: string } => !!item)

  if (items.length === 0) return null

  return (
    <section className="today-recap" aria-label="Today">
      {items.map((item) => (
        <p key={item.label} className="today-recap-item">
          <span className="today-recap-value">{item.value}</span>
          {item.label}
        </p>
      ))}
    </section>
  )
}
