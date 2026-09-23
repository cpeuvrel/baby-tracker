import { useState } from 'react'
import { DailyTimeline } from '../components/DailyTimeline'
import { HistoryFiltersModal } from '../components/HistoryFiltersModal'
import { GrowthIcon, ListViewIcon, SlidersIcon } from '../components/icons'
import { WeekTimelineChart } from '../components/WeekTimelineChart'
import { ALL_ENTRY_KINDS, type EntryKind } from '../lib/historyFilters'
import { dayKey } from '../lib/timeline'

function formatDayTitle(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

type HistoryView = 'graph' | 'data'

export function HistoryPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState<HistoryView>('graph')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [visibleKinds, setVisibleKinds] = useState<Set<EntryKind>>(() => new Set(ALL_ENTRY_KINDS))

  return (
    <div>
      <div className="history-header">
        <h2>History</h2>
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
