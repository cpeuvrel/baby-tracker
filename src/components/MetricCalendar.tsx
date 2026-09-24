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
}

export function MetricCalendar({ dayKeys, colorVar, intervals, instants }: MetricCalendarProps) {
  const blocksByDay = useMemo(
    () => (intervals ? buildWeekBlocks(dayKeys, intervals) : {}),
    [dayKeys, intervals],
  )
  const marksByDay = useMemo(
    () => (instants ? buildWeekMarks(dayKeys, instants) : {}),
    [dayKeys, instants],
  )
  const todayKey = dayKey(new Date())

  return (
    <div className="week-chart-grid" aria-label="Metric calendar">
      <div className="week-chart-axis">
        {HOUR_LABELS.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}</span>
        ))}
      </div>
      {dayKeys.map((key) => {
        const date = parseDayKey(key)
        return (
          <div key={key} className="week-chart-day">
            <div className={`week-chart-day-header${key === todayKey ? ' is-today' : ''}`}>
              <span>{formatDate(date, { weekday: 'short' }).slice(0, 2)}</span>
              <span>{dayOfMonth(key)}</span>
            </div>
            <div className="week-chart-column">
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
