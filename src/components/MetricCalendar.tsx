import { useMemo } from 'react'
import { formatDate } from '../lib/appTime'
import { dayKey, parseDayKey } from '../lib/timeline'
import { buildWeekBlocks, buildWeekMarks, nightFractions } from '../lib/weekTimeline'
import type { NighttimeHours } from '../types/models'
import { TimelineGrid } from './TimelineGrid'

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

interface MetricCalendarProps {
  dayKeys: string[]
  colorVar: string
  intervals?: Array<{ start: Date; end: Date }>
  instants?: Date[]
  /** Time ("HH:mm") each column starts at, the day before its date when after midnight (sleep days start at night). */
  dayStart?: string
  /** The selected day, or null when none is. */
  selectedKey: string | null
  /** Called with the tapped day's key, or null when the selected day is tapped again. */
  onSelectDay: (dayKey: string | null) => void
  /** The baby's night, shaded as paler bands. */
  nightRange?: NighttimeHours
  onPrevious?: () => void
  onNext?: () => void
}

function minutesOf(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/** "HH" on the hour ("HH:mm" otherwise, or always with `withMinutes`), wrapping past midnight. */
function formatAxisLabel(minutes: number, withMinutes = false): string {
  const hour = String(Math.floor(minutes / 60) % 24).padStart(2, '0')
  const minute = String(minutes % 60).padStart(2, '0')
  return minutes % 60 === 0 && !withMinutes ? hour : `${hour}:${minute}`
}

function formatLongDay(key: string): string {
  return formatDate(parseDayKey(key), { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * One 24-hour column per day with the metric's entries drawn at their time of day.
 * Tapping a day (its date or its column) selects it; tapping it again clears the selection.
 */
export function MetricCalendar({
  dayKeys,
  colorVar,
  intervals,
  instants,
  dayStart = '00:00',
  nightRange,
  selectedKey,
  onSelectDay,
  onPrevious,
  onNext,
}: MetricCalendarProps) {
  const startMinutes = minutesOf(dayStart)
  /** Moves times so each column's start lands on midnight of its date. */
  const shiftMs = startMinutes > 0 ? (24 * 60 - startMinutes) * 60_000 : 0
  const blocksByDay = useMemo(() => {
    if (!intervals) return {}
    const shift = (date: Date) => new Date(date.getTime() + shiftMs)
    return buildWeekBlocks(
      dayKeys,
      intervals.map(({ start, end }) => ({ start: shift(start), end: shift(end) })),
    )
  }, [dayKeys, intervals, shiftMs])
  const marksByDay = useMemo(
    () => (instants ? buildWeekMarks(dayKeys, instants.map((date) => new Date(date.getTime() + shiftMs))) : {}),
    [dayKeys, instants, shiftMs],
  )
  const toggleDay = (key: string) => onSelectDay(key === selectedKey ? null : key)
  // Night hours relative to the column start (a column may start in the evening).
  const nightBands = nightRange
    ? nightFractions({
        start: formatAxisLabel(minutesOf(nightRange.start) - startMinutes + 24 * 60, true),
        end: formatAxisLabel(minutesOf(nightRange.end) - startMinutes + 24 * 60, true),
      })
    : []

  return (
    <div className="metric-calendar" aria-label="Metric calendar">
      <TimelineGrid
        dayKeys={dayKeys}
        visibleDays={dayKeys.length}
        axisLabels={HOUR_LABELS.map((hour) => formatAxisLabel(startMinutes + hour * 60))}
        nightBands={nightBands}
        selectedKey={selectedKey}
        todayKey={dayKey(new Date())}
        onSelectDay={toggleDay}
        dayLabel={formatLongDay}
        weekdayLabel={(key) => formatDate(parseDayKey(key), { weekday: 'short' }).slice(0, 2)}
        pressable
        columnLabel={(key) => `${formatLongDay(key)} timeline`}
        onPrevious={onPrevious}
        onNext={onNext}
        previousLabel="Previous period"
        nextLabel="Next period"
        renderColumn={(key) => (
          <>
            {blocksByDay[key]?.map((block, index) => (
              <span
                key={`block-${index}`}
                className="timeline-grid-block"
                style={{
                  top: `${block.startFraction * 100}%`,
                  height: `${(block.endFraction - block.startFraction) * 100}%`,
                  background: `var(${colorVar})`,
                }}
              />
            ))}
            {marksByDay[key]?.map((mark, index) => (
              <span
                key={`mark-${index}`}
                className="timeline-grid-mark"
                style={{ top: `${mark.atFraction * 100}%`, background: `var(${colorVar})` }}
              />
            ))}
          </>
        )}
      />
    </div>
  )
}
