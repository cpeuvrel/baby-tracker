import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DailyBarChart } from '../components/charts/DailyBarChart'
import { MetricCalendar } from '../components/MetricCalendar'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { averageOfPoints, computeDelta } from '../lib/aggregations'
import { dayKeysInRange, dayRange, lastNDaysRange, precedingRange } from '../lib/timeline'
import {
  computeMetricSeries,
  formatMetricHeadline,
  formatMetricValue,
  getTrendMetric,
} from '../lib/trendMetrics'

const RANGE_DAYS = [1, 7, 14]
type ViewMode = 'calendar' | 'graph' | 'entries'

function describeFeedingEntry(entry: { occurredAt: string; type: string; volumeMl: number | null; foodType: string | null }): string {
  const time = new Date(entry.occurredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (entry.type === 'bottle') return `${time} — Bottle${entry.volumeMl != null ? ` ${entry.volumeMl} mL` : ''}`
  return `${time} — Solid${entry.foodType ? ` (${entry.foodType})` : ''}`
}

function describeSleepEntry(entry: { startedAt: string; durationSeconds: number | null }): string {
  const time = new Date(entry.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${time} — Sleep${entry.durationSeconds != null ? ` (${formatMetricValue('sleepTotal', entry.durationSeconds)})` : ' (in progress)'}`
}

function describeDiaperEntry(entry: { occurredAt: string; type: string }): string {
  const time = new Date(entry.occurredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const labels: Record<string, string> = { wet: 'Wet', dirty: 'Dirty', both: 'Wet + Dirty', dry: 'Dry' }
  return `${time} — Diaper (${labels[entry.type]})`
}

export function TrendDetailPage() {
  const { metricId } = useParams<{ metricId: string }>()
  const navigate = useNavigate()
  const { household, selectedBaby } = useHousehold()
  const [days, setDays] = useState(14)
  const [view, setView] = useState<ViewMode>('calendar')
  const now = useMemo(() => new Date(), [])

  const metric = metricId ? getTrendMetric(metricId) : undefined
  const currentRange = days === 1 ? dayRange(now) : lastNDaysRange(now, days)
  const previousRange = precedingRange(currentRange)

  const current = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, currentRange)
  const previous = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, previousRange)

  if (!household || !selectedBaby || !metric) return null

  const currentDayKeys = dayKeysInRange(currentRange)
  const series = computeMetricSeries(metric.id, currentDayKeys, current)
  const currentAvg = averageOfPoints(series)
  const previousAvg = averageOfPoints(
    computeMetricSeries(metric.id, dayKeysInRange(previousRange), previous),
  )
  const delta = computeDelta(currentAvg, previousAvg)

  return (
    <div>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate('/trends')}>
          ‹
        </button>
        <h2>{metric.title}</h2>
      </div>

      <p className="detail-headline">{formatMetricHeadline(metric.id, currentAvg)}</p>

      <div role="group" aria-label="View">
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

      <div role="group" aria-label="Period">
        {RANGE_DAYS.map((d) => (
          <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
            {d}d
          </button>
        ))}
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
        <DailyBarChart
          title={metric.title}
          data={series}
          seriesColorVar="--series-1"
          formatValue={(value) => formatMetricValue(metric.id, value)}
        />
      )}

      {view === 'entries' && (
        <ul className="detail-entries">
          {metric.kind === 'feeding' &&
            [...current.feeding].reverse().map((entry) => (
              <li key={entry.id}>{describeFeedingEntry(entry)}</li>
            ))}
          {metric.kind === 'sleep' &&
            [...current.sleep].reverse().map((entry) => <li key={entry.id}>{describeSleepEntry(entry)}</li>)}
          {metric.kind === 'diaper' &&
            [...current.diaper].reverse().map((entry) => (
              <li key={entry.id}>{describeDiaperEntry(entry)}</li>
            ))}
        </ul>
      )}

      {delta.direction !== 'flat' && (
        <p className="detail-delta-caption">
          {delta.direction === 'up' ? '↑' : '↓'} {formatMetricValue(metric.id, Math.abs(delta.value))}{' '}
          vs. the previous {days} days
        </p>
      )}
    </div>
  )
}
