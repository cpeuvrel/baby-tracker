import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DailyTimeline } from '../components/DailyTimeline'
import { HistoryFiltersModal } from '../components/HistoryFiltersModal'
import { GrowthIcon, ListViewIcon, SlidersIcon } from '../components/icons'
import { WeekTimelineChart } from '../components/WeekTimelineChart'
import { formatDate } from '../lib/appTime'
import { ALL_ENTRY_KINDS, type EntryKind } from '../lib/historyFilters'
import { dayKey } from '../lib/timeline'

function formatDayTitle(date: Date): string {
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
}

type HistoryView = 'graph' | 'data'

/** What a link to History can ask for, e.g. the Activity cards' "Entries before 20:00": a day's list. */
export interface HistoryLocationState {
  view?: HistoryView
  /** ISO instant in the day to show. */
  date?: string
}

function readLocationState(state: unknown): { view: HistoryView; date: Date } {
  const requested = (state ?? {}) as HistoryLocationState
  const date = requested.date ? new Date(requested.date) : null
  return {
    view: requested.view === 'data' ? 'data' : 'graph',
    date: date && !Number.isNaN(date.getTime()) ? date : new Date(),
  }
}

export function HistoryPage() {
  const location = useLocation()
  const [initial] = useState(() => readLocationState(location.state))
  const [selectedDate, setSelectedDate] = useState(initial.date)
  const [view, setView] = useState<HistoryView>(initial.view)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [visibleKinds, setVisibleKinds] = useState<Set<EntryKind>>(() => new Set(ALL_ENTRY_KINDS))

  return (
    <div>
      <div className="history-header">
        <div className="history-header-actions">
          <button type="button" aria-label="Filters" onClick={() => setFiltersOpen(true)}>
            <SlidersIcon />
          </button>
          <button
            type="button"
            aria-label={view === 'graph' ? 'Show data' : 'Show graph'}
            onClick={() => setView((current) => (current === 'graph' ? 'data' : 'graph'))}
          >
            {view === 'graph' ? <ListViewIcon /> : <GrowthIcon />}
          </button>
        </div>
      </div>

      <WeekTimelineChart
        onSelectDay={setSelectedDate}
        selectedDayKey={dayKey(selectedDate)}
        visibleKinds={visibleKinds}
        showChart={view === 'graph'}
      />

      {view === 'data' && (
        <DailyTimeline date={selectedDate} title={formatDayTitle(selectedDate)} visibleKinds={visibleKinds} />
      )}

      {filtersOpen && (
        <HistoryFiltersModal
          visibleKinds={visibleKinds}
          onApply={setVisibleKinds}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  )
}
