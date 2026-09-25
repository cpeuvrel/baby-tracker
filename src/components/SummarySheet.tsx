import { useState, type ReactNode } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActivityVisibility, type ActivityCategory } from '../hooks/useActivityVisibility'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { buildActivitySummary, type SummaryRowId } from '../lib/activitySummary'
import { addDays } from '../lib/appTime'
import { dayRange, type DateRange } from '../lib/timeline'
import { BlobIcon } from './BlobIcon'
import { BathIcon, DiaperIcon, FeedIcon, MedicationIcon, SleepIcon } from './icons'
import { Modal } from './Modal'

type SummaryPeriod = 'today' | 'last24h'

const HOURS_24_MS = 24 * 3600 * 1000

const ROW_STYLE: Record<SummaryRowId, { icon: ReactNode; colorVar: string; category: ActivityCategory }> = {
  bottle: { icon: <FeedIcon />, colorVar: '--category-feeding', category: 'feeding' },
  solid: { icon: <FeedIcon />, colorVar: '--category-feeding', category: 'feeding' },
  sleep: { icon: <SleepIcon />, colorVar: '--category-sleep', category: 'sleep' },
  diaper: { icon: <DiaperIcon />, colorVar: '--category-diaper', category: 'diaper' },
  bath: { icon: <BathIcon />, colorVar: '--category-routine', category: 'routine' },
  medication: { icon: <MedicationIcon />, colorVar: '--category-routine', category: 'routine' },
}

function periodRange(period: SummaryPeriod, now: Date): DateRange {
  if (period === 'today') return dayRange(now)
  return { start: new Date(now.getTime() - HOURS_24_MS), end: now }
}

/** Totals per category for today or the last 24 hours (the header's "…" button). */
export function SummarySheet({ onClose }: { onClose: () => void }) {
  const { household, selectedBaby } = useHousehold()
  const { isVisible } = useActivityVisibility()
  // Fixed when the sheet opens, so the range (and its subscriptions) stays stable.
  const [now] = useState(() => new Date())
  const [period, setPeriod] = useState<SummaryPeriod>('today')

  const range = periodRange(period, now)
  // Sleeps are queried by start time: look back a day to catch the one running over the range's start.
  const queryRange = { start: addDays(range.start, -1), end: range.end }
  const entries = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, queryRange)
  const rows = buildActivitySummary(entries, range, now).filter((row) => isVisible(ROW_STYLE[row.id].category))

  return (
    <Modal title="Summary" bandColorVar="--card-bg" onClose={onClose}>
      <div role="group" aria-label="Period" className="segmented-control detail-view-tabs">
        <button type="button" aria-pressed={period === 'today'} onClick={() => setPeriod('today')}>
          Today
        </button>
        <button type="button" aria-pressed={period === 'last24h'} onClick={() => setPeriod('last24h')}>
          Last 24 Hours
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">Nothing logged yet.</p>
      ) : (
        <ul className="summary-rows">
          {rows.map((row) => (
            <li key={row.id} className="summary-row">
              <BlobIcon colorVar={ROW_STYLE[row.id].colorVar}>{ROW_STYLE[row.id].icon}</BlobIcon>
              <div>
                <p className="summary-row-title">
                  {row.title}
                  <span className="summary-row-count" style={{ background: `var(${ROW_STYLE[row.id].colorVar})` }}>
                    {row.count}
                  </span>
                </p>
                {row.lines.map((line) => (
                  <p key={line} className="summary-row-line">
                    {line}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
