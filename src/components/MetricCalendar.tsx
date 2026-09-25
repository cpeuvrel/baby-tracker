import { useMemo } from 'react'
import { formatDate } from '../lib/appTime'
import { dayKey, dayOfMonth, parseDayKey } from '../lib/timeline'
import { buildWeekBlocks, buildWeekMarks } from '../lib/weekTimeline'

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

interface MetricCalendarProps {
  dayKeys: string[]
  colorVar: string
  intervals?: Array<{ start: Date; end: Date }>
  instants?: Date[]
  /** The selected day, or null when none is. */
  selectedKey: string | null
  /** Called with the tapped day's key, or null when the selected day is tapped again. */
  onSelectDay: (dayKey: string | null) => void
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
  selectedKey,
  onSelectDay,
}: MetricCalendarProps) {
  const blocksByDay = useMemo(
    () => (intervals ? buildWeekBlocks(dayKeys, intervals) : {}),
    [dayKeys, intervals],
  )
  const marksByDay = useMemo(
    () => (instants ? buildWeekMarks(dayKeys, instants) : {}),
    [dayKeys, instants],
  )
  const todayKey = dayKey(new Date())
  const toggleDay = (key: string) => onSelectDay(key === selectedKey ? null : key)

  return (
    <div className="week-chart-grid" aria-label="Metric calendar">
      <div className="week-chart-axis">
        {HOUR_LABELS.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}</span>
        ))}
      </div>
      {dayKeys.map((key) => {
        const date = parseDayKey(key)
        const isSelected = key === selectedKey
        return (
          <div key={key} className="week-chart-day">
            <button
              type="button"
              className={`week-chart-day-header${key === todayKey ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
              aria-label={formatLongDay(key)}
              aria-pressed={isSelected}
              onClick={() => toggleDay(key)}
            >
              <span>{formatDate(date, { weekday: 'short' }).slice(0, 2)}</span>
              <span>{dayOfMonth(key)}</span>
            </button>
            <button
              type="button"
              className={`week-chart-column metric-calendar-column${isSelected ? ' is-selected' : ''}`}
              aria-label={`${formatLongDay(key)} timeline`}
              aria-pressed={isSelected}
              onClick={() => toggleDay(key)}
            >
              {HOUR_LABELS.slice(1, -1).map((hour) => (
                <span
                  key={hour}
                  className="week-chart-gridline"
                  style={{ top: `${(hour / 24) * 100}%` }}
                />
              ))}
              {blocksByDay[key]?.map((block, index) => (
                <span
                  key={index}
                  className="week-chart-block"
                  style={{
                    top: `${block.startFraction * 100}%`,
                    height: `${(block.endFraction - block.startFraction) * 100}%`,
                    background: `var(${colorVar})`,
                  }}
                />
              ))}
              {marksByDay[key]?.map((mark, index) => (
                <span
                  key={index}
                  className="week-chart-mark"
                  style={{ top: `${mark.atFraction * 100}%`, background: `var(${colorVar})` }}
                />
              ))}
            </button>
          </div>
        )
      })}
    </div>
  )
}
