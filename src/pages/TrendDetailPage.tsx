import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { CalendarIcon, ClockIcon, DiaperIcon, FeedIcon, SleepIcon } from '../components/icons'
import { MetricCalendar } from '../components/MetricCalendar'
import { MetricGraph } from '../components/MetricGraph'
import { SleepEntryEditModal } from '../components/SleepEntryEditModal'
import { SleepTimerModal } from '../components/SleepTimerModal'
import { TrendEntriesList } from '../components/TrendEntriesList'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { addDays, formatTime } from '../lib/appTime'
import { computeDelta, DEFAULT_NIGHTTIME_HOURS, startsDuringNight } from '../lib/aggregations'
import { CALENDAR_DAYS, dayKey, framePeriod, rollingDayFrame } from '../lib/timeline'
import {
  chartStyleOf,
  computeAxisTicks,
  computeMetricSeries,
  computeMetricSummary,
  displayDelta,
  formatMetricAxisValue,
  formatMetricDayHeadline,
  formatMetricHeadline,
  formatMetricValue,
  filterMetricEntries,
  getTrendMetric,
  metricDayKeyOf,
  metricSleepSegments,
  trendFetchRange,
  type TrendKind,
} from '../lib/trendMetrics'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

const RANGE_DAYS = [1, 7, 14]
const DEFAULT_DAYS = 14
type ViewMode = 'calendar' | 'graph' | 'entries'
/** How the Calendar and Graph views cut the period into days: calendar days, or rolling 24 hours ending now. */
type DayMode = 'calendar' | 'rolling'

/** The current time, to the second (rolling days start on a whole second). */
function currentTime(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000)
}

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
  // Opened from the Trends list: its period (`?days=`), and the day its headline comes from
  // (`?day=`, e.g. the longest sleep).
  const [searchParams] = useSearchParams()
  const [days, setDays] = useState(() => {
    const fromLink = Number(searchParams.get('days'))
    return RANGE_DAYS.includes(fromLink) ? fromLink : DEFAULT_DAYS
  })
  const [view, setView] = useState<ViewMode>('calendar')
  const [editing, setEditing] = useState<EditState>(null)
  /** Day selected in the Calendar or Graph view: shown in the headline and focused in the Entries view. */
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() => searchParams.get('day'))
  const [dayMode, setDayMode] = useState<DayMode>('calendar')
  /** Taken when the page opens and again whenever the display changes: rolling days end at this time. */
  const [now, setNow] = useState(currentTime)
  /** How many whole periods back from today the page shows (0 = ending today, the maximum). */
  const [periodsBack, setPeriodsBack] = useState(0)

  const metric = metricId ? getTrendMetric(metricId) : undefined
  const frame = useMemo(() => (dayMode === 'rolling' ? rollingDayFrame(now) : CALENDAR_DAYS), [dayMode, now])
  const { range: currentRange, dayKeys: currentDayKeys } = useMemo(
    () => framePeriod(frame, dayKey(addDays(now, -periodsBack * days)), days),
    [frame, now, periodsBack, days],
  )
  const { range: previousRange, dayKeys: previousDayKeys } = useMemo(
    () => framePeriod(frame, dayKey(addDays(now, -(periodsBack + 1) * days)), days),
    [frame, now, periodsBack, days],
  )

  const nightRange = selectedBaby?.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS

  // Loaded from the night before each period, as a period's first sleep day starts then, in
  // whole calendar days: switching views in rolling mode (a new `now`) keeps the same listeners.
  const current = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    trendFetchRange(currentRange),
  )
  const previous = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    trendFetchRange(previousRange),
  )
  const currentEntries = useMemo(
    () => ({ feeding: current.feeding, sleep: current.sleep, diaper: current.diaper }),
    [current.feeding, current.sleep, current.diaper],
  )
  const previousEntries = useMemo(
    () => ({ feeding: previous.feeding, sleep: previous.sleep, diaper: previous.diaper }),
    [previous.feeding, previous.sleep, previous.diaper],
  )

  /** Day an entry counts on in the period (its rolling window in rolling mode). */
  const frameKeyOf = useMemo(() => metricDayKeyOf(frame), [frame])
  const inPeriod = useMemo(() => new Set(currentDayKeys), [currentDayKeys])
  const sleepSegments = useMemo(
    () =>
      metric?.kind === 'sleep'
        ? metricSleepSegments(metric.id, currentDayKeys, currentEntries.sleep, nightRange, now, frame)
        : [],
    [metric, currentDayKeys, currentEntries.sleep, nightRange, now, frame],
  )
  // What the Entries view lists: the period's entries that make up the metric (e.g. only the
  // sleeps with a daytime part for Daytime Sleep, each day's longest for Longest Sleep).
  const shown = useMemo(() => {
    const inMetric = new Set(sleepSegments.filter((segment) => segment.inMetric).map((segment) => segment.entry.id))
    const periodEntries = {
      feeding: currentEntries.feeding.filter((entry) => inPeriod.has(frameKeyOf(entry.occurredAt))),
      sleep: currentEntries.sleep.filter((entry) => inMetric.has(entry.id)),
      diaper: currentEntries.diaper.filter((entry) => inPeriod.has(frameKeyOf(entry.occurredAt))),
    }
    return metric
      ? filterMetricEntries(metric.id, periodEntries, nightRange, currentDayKeys, now, frame)
      : periodEntries
  }, [metric, sleepSegments, currentEntries, inPeriod, frameKeyOf, nightRange, currentDayKeys, now, frame])
  // In the Calendar, a selected day brings out what the metric counts on it, the rest faded:
  // its feeds or diapers, the sleeps counted on it (its longest, for Longest Sleep).
  const calendarSleepSegments = useMemo(
    () =>
      metric?.kind === 'sleep' && selectedDayKey
        ? metricSleepSegments(metric.id, currentDayKeys, currentEntries.sleep, nightRange, now, frame, selectedDayKey)
        : sleepSegments,
    [metric, selectedDayKey, currentDayKeys, currentEntries.sleep, nightRange, now, frame, sleepSegments],
  )
  const series = useMemo(
    () => (metric ? computeMetricSeries(metric.id, currentDayKeys, currentEntries, nightRange, now, frame) : []),
    [metric, currentDayKeys, currentEntries, nightRange, now, frame],
  )
  const currentAvg = useMemo(
    () => (metric ? computeMetricSummary(metric.id, currentDayKeys, currentEntries, nightRange, now, frame) : 0),
    [metric, currentDayKeys, currentEntries, nightRange, now, frame],
  )
  const previousAvg = useMemo(
    () => (metric ? computeMetricSummary(metric.id, previousDayKeys, previousEntries, nightRange, now, frame) : 0),
    [metric, previousDayKeys, previousEntries, nightRange, now, frame],
  )

  if (!metric) return <Navigate to="/trends" replace />
  if (!household || !selectedBaby) return null

  const changePeriod = (update: (back: number) => number) => {
    setSelectedDayKey(null)
    setPeriodsBack(update)
    setNow(currentTime())
  }
  const changeView = (next: ViewMode) => {
    setView(next)
    setNow(currentTime())
  }
  const toggleDayMode = () => {
    setSelectedDayKey(null)
    setDayMode((mode) => (mode === 'calendar' ? 'rolling' : 'calendar'))
    setNow(currentTime())
  }

  /** Day the Entries view lists an entry under: always its calendar day. */
  const dayKeyOf = metricDayKeyOf()
  const onSelectedDay = (iso: string) => !selectedDayKey || frameKeyOf(iso) === selectedDayKey
  const isMetricDiaper = (iso: string) =>
    metric.id === 'diaperDay'
      ? !startsDuringNight(iso, nightRange)
      : metric.id === 'diaperNight'
        ? startsDuringNight(iso, nightRange)
        : true
  // A change too small to show at the metric's precision is no change ("↑ 0 mL").
  const delta = displayDelta(metric.id, computeDelta(currentAvg, previousAvg))
  /** Top of the Graph view's y axis: its ticks and their labels share one unit. */
  const axisMax = Math.max(currentAvg, ...series.map((point) => point.value))
  const selectedPoint = series.find((point) => point.dayKey === selectedDayKey)

  return (
    <div>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate('/trends')}>
          ←
        </button>
        <h2>{metric.title}</h2>
        {view !== 'entries' && (
          <button
            type="button"
            className="detail-day-mode"
            aria-label={dayMode === 'calendar' ? 'Show rolling 24 hours' : 'Show calendar days'}
            onClick={toggleDayMode}
          >
            {dayMode === 'calendar' ? <ClockIcon /> : <CalendarIcon />}
          </button>
        )}
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
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => changeView('calendar')}>
          Calendar
        </button>
        <button type="button" aria-pressed={view === 'graph'} onClick={() => changeView('graph')}>
          Graph
        </button>
        <button type="button" aria-pressed={view === 'entries'} onClick={() => changeView('entries')}>
          Entries
        </button>
      </div>

      {dayMode === 'rolling' && view !== 'entries' && (
        <p className="detail-day-mode-caption">
          Rolling 24 h, ending at {formatTime(now, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
        </p>
      )}

      {view === 'calendar' && (
        <MetricCalendar
          dayKeys={currentDayKeys}
          colorVar={metric.colorVar}
          selectedKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          nightRange={nightRange}
          now={now}
          frame={frame}
          onPrevious={() => changePeriod((back) => back + 1)}
          onNext={periodsBack > 0 ? () => changePeriod((back) => back - 1) : undefined}
          blocks={calendarSleepSegments.map((segment) => ({
            start: segment.start,
            end: segment.end,
            faded: !segment.inMetric,
          }))}
          marks={
            metric.kind === 'feeding'
              ? shown.feeding.map((entry) => ({
                  at: new Date(entry.occurredAt),
                  faded: !onSelectedDay(entry.occurredAt),
                }))
              : metric.kind === 'diaper'
                ? current.diaper
                    .filter((entry) => inPeriod.has(frameKeyOf(entry.occurredAt)))
                    .map((entry) => ({
                      at: new Date(entry.occurredAt),
                      faded: !isMetricDiaper(entry.occurredAt) || !onSelectedDay(entry.occurredAt),
                    }))
                : undefined
          }
        />
      )}

      {view === 'graph' && (
        <MetricGraph
          key={`${dayMode}-${currentDayKeys[0]}`}
          data={series}
          average={currentAvg}
          ticks={computeAxisTicks(metric.id, axisMax)}
          chartStyle={chartStyleOf(metric)}
          colorVar={metric.colorVar}
          icon={KIND_ICONS[metric.kind]}
          seriesLabel={metric.seriesLabel}
          formatValue={(value) => formatMetricValue(metric.id, value)}
          formatTick={(value) => formatMetricAxisValue(metric.id, value, axisMax)}
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
          dayKeyOf={dayKeyOf}
          entries={shown.feeding}
          onSelect={(entry) => setEditing({ kind: 'feeding', entry })}
        />
      )}
      {view === 'entries' && metric.kind === 'sleep' && (
        <TrendEntriesList
          kind="sleep"
          colorVar={metric.colorVar}
          focusDayKey={selectedDayKey}
          dayKeyOf={dayKeyOf}
          entries={shown.sleep}
          onSelect={(entry) => setEditing({ kind: 'sleep', entry })}
        />
      )}
      {view === 'entries' && metric.kind === 'diaper' && (
        <TrendEntriesList
          kind="diaper"
          colorVar={metric.colorVar}
          focusDayKey={selectedDayKey}
          dayKeyOf={dayKeyOf}
          entries={shown.diaper}
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
            {metric.deltaWords[delta.direction === 'up' ? 0 : 1]} than the previous{' '}
            {days === 1 ? (dayMode === 'rolling' ? '24 hours' : 'day') : `${days} days`}
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
