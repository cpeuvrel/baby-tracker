import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  const [days, setDays] = useState(14)
  const [view, setView] = useState<ViewMode>('calendar')
  const [editing, setEditing] = useState<EditState>(null)
  /** Day selected in the Calendar or Graph view: shown in the headline and focused in the Entries view. */
  // Opened from a headline that comes from one day (`?day=`, e.g. the longest sleep): that day.
  const [searchParams] = useSearchParams()
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() => searchParams.get('day'))
  const [dayMode, setDayMode] = useState<DayMode>('calendar')
  /** Taken when the page opens and again whenever the display changes: rolling days end at this time. */
  const [now, setNow] = useState(currentTime)
  /** How many whole periods back from today the page shows (0 = ending today, the maximum). */
  const [periodsBack, setPeriodsBack] = useState(0)

  const metric = metricId ? getTrendMetric(metricId) : undefined
  const frame = useMemo(() => (dayMode === 'rolling' ? rollingDayFrame(now) : CALENDAR_DAYS), [dayMode, now])
  const { range: currentRange, dayKeys: currentDayKeys } = framePeriod(
    frame,
    dayKey(addDays(now, -periodsBack * days)),
    days,
  )
  const { range: previousRange, dayKeys: previousDayKeys } = framePeriod(
    frame,
    dayKey(addDays(now, -(periodsBack + 1) * days)),
    days,
  )

  const nightRange = selectedBaby?.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS

  // Loaded from the night before each period, as a period's first sleep day starts then.
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

  if (!household || !selectedBaby || !metric) return null

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

  /** Day an entry counts on in the period (its rolling window in rolling mode). */
  const frameKeyOf = metricDayKeyOf(frame)
  /** Day the Entries view lists an entry under: always its calendar day. */
  const dayKeyOf = metricDayKeyOf()
  const inPeriod = new Set(currentDayKeys)
  const sleepSegments =
    metric.kind === 'sleep'
      ? metricSleepSegments(metric.id, currentDayKeys, current.sleep, nightRange, now, frame)
      : []
  // What the Entries view lists: the period's entries that make up the metric (e.g. only the
  // sleeps with a daytime part for Daytime Sleep, each day's longest for Longest Sleep).
  const shown = filterMetricEntries(
    metric.id,
    {
      feeding: current.feeding.filter((entry) => inPeriod.has(frameKeyOf(entry.occurredAt))),
      sleep: current.sleep.filter((entry) =>
        sleepSegments.some((segment) => segment.inMetric && segment.entry.id === entry.id),
      ),
      diaper: current.diaper.filter((entry) => inPeriod.has(frameKeyOf(entry.occurredAt))),
    },
    nightRange,
    currentDayKeys,
    now,
    frame,
  )
  // In the Calendar, a selected day brings out what the metric counts on it, the rest faded:
  // its feeds or diapers, the sleeps counted on it (its longest, for Longest Sleep).
  const onSelectedDay = (iso: string) => !selectedDayKey || frameKeyOf(iso) === selectedDayKey
  const calendarSleepSegments =
    metric.kind === 'sleep' && selectedDayKey
      ? metricSleepSegments(metric.id, currentDayKeys, current.sleep, nightRange, now, frame, selectedDayKey)
      : sleepSegments
  const isMetricDiaper = (iso: string) =>
    metric.id === 'diaperDay'
      ? !startsDuringNight(iso, nightRange)
      : metric.id === 'diaperNight'
        ? startsDuringNight(iso, nightRange)
        : true
  const series = computeMetricSeries(metric.id, currentDayKeys, current, nightRange, now, frame)
  const currentAvg = computeMetricSummary(metric.id, currentDayKeys, current, nightRange, now, frame)
  const previousAvg = computeMetricSummary(metric.id, previousDayKeys, previous, nightRange, now, frame)
  const delta = computeDelta(currentAvg, previousAvg)
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
          ticks={computeAxisTicks(metric.id, Math.max(currentAvg, ...series.map((point) => point.value)))}
          chartStyle={chartStyleOf(metric)}
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
