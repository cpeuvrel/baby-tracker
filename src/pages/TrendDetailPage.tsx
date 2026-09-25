import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { DiaperIcon, FeedIcon, SleepIcon } from '../components/icons'
import { MetricCalendar } from '../components/MetricCalendar'
import { MetricGraph } from '../components/MetricGraph'
import { SleepEntryEditModal } from '../components/SleepEntryEditModal'
import { SleepTimerModal } from '../components/SleepTimerModal'
import { TrendEntriesList } from '../components/TrendEntriesList'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { addDays } from '../lib/appTime'
import { averageOfPoints, computeDelta, DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { dayKeysInRange, dayRange, lastNDaysRange, precedingRange } from '../lib/timeline'
import {
  computeAxisTicks,
  computeMetricSeries,
  formatMetricAxisValue,
  formatMetricDayHeadline,
  formatMetricHeadline,
  formatMetricValue,
  getTrendMetric,
  type TrendKind,
} from '../lib/trendMetrics'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

const RANGE_DAYS = [1, 7, 14]
type ViewMode = 'calendar' | 'graph' | 'entries'

const KIND_ICONS: Record<TrendKind, ReactNode> = {
  feeding: <FeedIcon />,
  sleep: <SleepIcon />,
  diaper: <DiaperIcon />,
}

type EditState =
  | { kind: 'feeding'; entry: FeedingEntry }
  | { kind: 'sleep'; entry: SleepEntry }
  | { kind: 'diaper'; entry: DiaperEntry }
  | null

export function TrendDetailPage() {
  const { metricId } = useParams<{ metricId: string }>()
  const navigate = useNavigate()
  const { household, selectedBaby } = useHousehold()
  const [days, setDays] = useState(14)
  const [view, setView] = useState<ViewMode>('calendar')
  const [editing, setEditing] = useState<EditState>(null)
  /** Day selected in the Graph view: shown in the headline and focused in the Entries view. */
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])
  /** How many whole periods back from today the page shows (0 = ending today, the maximum). */
  const [periodsBack, setPeriodsBack] = useState(0)

  const metric = metricId ? getTrendMetric(metricId) : undefined
  const periodEnd = addDays(now, -periodsBack * days)
  const currentRange = days === 1 ? dayRange(periodEnd) : lastNDaysRange(periodEnd, days)
  const previousRange = precedingRange(currentRange)

  const current = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, currentRange)
  const previous = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, previousRange)

  if (!household || !selectedBaby || !metric) return null

  const changePeriod = (update: (back: number) => number) => {
    setSelectedDayKey(null)
    setPeriodsBack(update)
  }

  const currentDayKeys = dayKeysInRange(currentRange)
  const nightRange = selectedBaby.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS
  const series = computeMetricSeries(metric.id, currentDayKeys, current, nightRange)
  const currentAvg = averageOfPoints(series)
  const previousAvg = averageOfPoints(
    computeMetricSeries(metric.id, dayKeysInRange(previousRange), previous, nightRange),
  )
  const delta = computeDelta(currentAvg, previousAvg)
  const selectedPoint = series.find((point) => point.dayKey === selectedDayKey)

  return (
    <div>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate('/trends')}>
          ←
        </button>
        <h2>{metric.title}</h2>
        <select
          className="detail-period-select"
          aria-label="Period"
          value={days}
          onChange={(event) => {
            setDays(Number(event.target.value))
            changePeriod(() => 0)
          }}
        >
          {RANGE_DAYS.map((d) => (
            <option key={d} value={d}>
              {d}d
            </option>
          ))}
        </select>
      </div>

      <p className="detail-headline">
        {selectedPoint
          ? formatMetricDayHeadline(metric.id, selectedPoint.value)
          : formatMetricHeadline(metric.id, currentAvg)}
      </p>

      <div role="group" aria-label="View" className="segmented-control detail-view-tabs">
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>
          Calendar
        </button>
        <button type="button" aria-pressed={view === 'graph'} onClick={() => setView('graph')}>
          Graph
        </button>
        <button type="button" aria-pressed={view === 'entries'} onClick={() => setView('entries')}>
          Entries
        </button>
      </div>

      {view === 'calendar' && (
        <MetricCalendar
          dayKeys={currentDayKeys}
          colorVar={metric.colorVar}
          intervals={
            metric.kind === 'sleep'
              ? current.sleep.map((entry) => ({
                  start: new Date(entry.startedAt),
                  end: entry.endedAt ? new Date(entry.endedAt) : new Date(),
                }))
              : undefined
          }
          instants={
            metric.kind === 'feeding'
              ? current.feeding.map((entry) => new Date(entry.occurredAt))
              : metric.kind === 'diaper'
                ? current.diaper.map((entry) => new Date(entry.occurredAt))
                : undefined
          }
        />
      )}

      {view === 'graph' && (
        <MetricGraph
          key={currentDayKeys[0]}
          data={series}
          average={currentAvg}
          ticks={computeAxisTicks(metric.id, Math.max(currentAvg, ...series.map((point) => point.value)))}
          chartStyle={metric.chartStyle}
          colorVar={metric.colorVar}
          icon={KIND_ICONS[metric.kind]}
          seriesLabel={metric.seriesLabel}
          formatValue={(value) => formatMetricValue(metric.id, value)}
          formatTick={(value) => formatMetricAxisValue(metric.id, value)}
          selectedKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          onPrevious={() => changePeriod((back) => back + 1)}
          onNext={periodsBack > 0 ? () => changePeriod((back) => back - 1) : undefined}
        />
      )}

      {view === 'entries' && metric.kind === 'feeding' && (
        <TrendEntriesList
          kind="feeding"
          colorVar={metric.colorVar}
          focusDayKey={selectedDayKey}
          entries={current.feeding}
          onSelect={(entry) => setEditing({ kind: 'feeding', entry })}
        />
      )}
      {view === 'entries' && metric.kind === 'sleep' && (
        <TrendEntriesList
          kind="sleep"
          colorVar={metric.colorVar}
          focusDayKey={selectedDayKey}
          entries={current.sleep}
          onSelect={(entry) => setEditing({ kind: 'sleep', entry })}
        />
      )}
      {view === 'entries' && metric.kind === 'diaper' && (
        <TrendEntriesList
          kind="diaper"
          colorVar={metric.colorVar}
          focusDayKey={selectedDayKey}
          entries={current.diaper}
          onSelect={(entry) => setEditing({ kind: 'diaper', entry })}
        />
      )}

      {delta.direction !== 'flat' && (
        <div className="detail-delta">
          <p className="detail-delta-value">
            <span className={`detail-delta-icon is-${delta.direction}`} aria-hidden="true">
              {delta.direction === 'up' ? '↑' : '↓'}
            </span>
            {formatMetricValue(metric.id, Math.abs(delta.value))}
          </p>
          <p className="detail-delta-caption">
            {delta.direction === 'up' ? 'More' : metric.id === 'sleepTotal' ? 'Less' : 'Fewer'} {metric.unitWord}{' '}
            than the previous {days === 1 ? 'day' : `${days} days`}
          </p>
        </div>
      )}

      {editing?.kind === 'feeding' && <FeedingForm entry={editing.entry} onClose={() => setEditing(null)} />}
      {editing?.kind === 'diaper' && <DiaperForm entry={editing.entry} onClose={() => setEditing(null)} />}
      {editing?.kind === 'sleep' &&
        (editing.entry.endedAt === null ? (
          <SleepTimerModal onClose={() => setEditing(null)} />
        ) : (
          <SleepEntryEditModal entry={editing.entry} onClose={() => setEditing(null)} />
        ))}
    </div>
  )
}
