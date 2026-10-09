import { useHousehold } from '../contexts/HouseholdContext'
import { useActivityVisibility } from '../hooks/useActivityVisibility'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { buildTodayTotals } from '../lib/activitySummary'
import { addDays } from '../lib/appTime'
import { formatDuration } from '../lib/duration'
import { dayRange } from '../lib/timeline'

/** Today's milk, sleep and diapers at a glance, above the activity cards. */
export function TodayRecap({ now }: { now: Date }) {
  const { household, selectedBaby } = useHousehold()
  const { isVisible } = useActivityVisibility()
  const range = dayRange(now)
  // Sleeps are queried by start time: look back a day to catch last night's.
  const queryRange = { start: addDays(range.start, -1), end: range.end }
  const entries = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, queryRange)
  const totals = buildTodayTotals(entries, range, now)

  const items = [
    isVisible('feeding') && { category: 'feeding', label: 'milk', value: `${totals.bottleMl} mL` },
    isVisible('sleep') && { category: 'sleep', label: 'sleep', value: formatDuration(totals.sleepSeconds) },
    isVisible('diaper') && {
      category: 'diaper',
      label: totals.diapers === 1 ? 'diaper' : 'diapers',
      value: String(totals.diapers),
    },
  ].filter((item): item is { category: string; label: string; value: string } => !!item)

  if (items.length === 0) return null

  return (
    <section className="today-recap" aria-label="Today">
      <h2 className="today-recap-title">Today so far</h2>
      <div className="today-recap-items">
        {items.map((item) => (
          <p key={item.category} className={`today-recap-item today-recap-${item.category}`}>
            <span className="today-recap-value">{item.value}</span>
            {item.label}
          </p>
        ))}
      </div>
    </section>
  )
}
