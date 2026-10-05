import { useMemo } from 'react'
import { formatDate } from '../lib/appTime'
import { CALENDAR_DAYS, dayKey, parseDayKey, type DayFrame } from '../lib/timeline'
import { markForInstant, nightFractions, splitIntervalByDay, type DayBlock, type DayMark } from '../lib/weekTimeline'
import type { NighttimeHours } from '../types/models'
import { TimelineGrid } from './TimelineGrid'

/** Hour labels down the side, every 3 hours from the start of the frame's days (00 for calendar days). */
function axisLabels(startSeconds: number): string[] {
  const startHour = Math.floor(startSeconds / 3600)
  return Array.from({ length: 9 }, (_, index) => {
    const hour = startHour + index * 3
    return String(startSeconds === 0 && index === 8 ? 24 : hour % 24).padStart(2, '0')
  })
}

export interface CalendarBlock {
  start: Date
  end: Date
  /** Not part of the metric (e.g. a night's sleep on Daytime Sleep): drawn paler. */
  faded?: boolean
}

export interface CalendarMark {
  at: Date
  faded?: boolean
}

interface MetricCalendarProps {
  dayKeys: string[]
  colorVar: string
  blocks?: CalendarBlock[]
  marks?: CalendarMark[]
  /** The selected day, or null when none is. */
  selectedKey: string | null
  /** Called with the tapped day's key, or null when the selected day is tapped again. */
  onSelectDay: (dayKey: string | null) => void
  /** The baby's night, shaded as paler bands. */
  nightRange?: NighttimeHours
  /** Current time, marked on today's column. */
  now?: Date
  /** How the columns cut time: calendar days (00 → 24, the default) or rolling 24-hour windows. */
  frame?: DayFrame
  onPrevious?: () => void
  onNext?: () => void
}

function formatLongDay(key: string): string {
  return formatDate(parseDayKey(key), { weekday: 'short', month: 'short', day: 'numeric' })
}

function groupByDay<T extends { dayKey: string }>(dayKeys: string[], items: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = Object.fromEntries(dayKeys.map((key) => [key, []]))
  for (const item of items) result[item.dayKey]?.push(item)
  return result
}

/**
 * One column per day of the period (a calendar day, 00 → 24, or a rolling 24-hour window), with the baby's sleeps or events
 * drawn at their time of day: the parts that make up the metric in full colour, the others
 * faded, the night shaded behind. Tapping a day (its date or its column) selects it;
 * tapping it again clears the selection.
 */
export function MetricCalendar({
  dayKeys,
  colorVar,
  blocks = [],
  marks = [],
  nightRange,
  now = new Date(),
  frame = CALENDAR_DAYS,
  selectedKey,
  onSelectDay,
  onPrevious,
  onNext,
}: MetricCalendarProps) {
  const blocksByDay = useMemo(
    () =>
      groupByDay<DayBlock & { faded: boolean }>(
        dayKeys,
        blocks.flatMap(({ start, end, faded = false }) =>
          splitIntervalByDay(start, end, frame).map((block) => ({ ...block, faded })),
        ),
      ),
    [dayKeys, blocks, frame],
  )
  const marksByDay = useMemo(
    () =>
      groupByDay<DayMark & { faded: boolean }>(
        dayKeys,
        marks.map(({ at, faded = false }) => ({ ...markForInstant(at, frame), faded })),
      ),
    [dayKeys, marks, frame],
  )
  const todayKey = dayKey(now)
  const nowMark = markForInstant(now, frame)
  const toggleDay = (key: string) => onSelectDay(key === selectedKey ? null : key)

  return (
    <div className="metric-calendar" aria-label="Metric calendar">
      <TimelineGrid
        dayKeys={dayKeys}
        visibleDays={dayKeys.length}
        axisLabels={axisLabels(frame.startSeconds)}
        nightBands={nightRange ? nightFractions(nightRange, frame.startSeconds) : []}
        selectedKey={selectedKey}
        highlightKey={selectedKey ?? todayKey}
        todayKey={todayKey}
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
                className={`timeline-grid-block${block.faded ? ' is-faded' : ''}`}
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
                className={`timeline-grid-mark${mark.faded ? ' is-faded' : ''}`}
                style={{ top: `${mark.atFraction * 100}%`, background: `var(${colorVar})` }}
              />
            ))}
            {key === nowMark.dayKey && (
              <span className="timeline-grid-now" aria-hidden="true" style={{ top: `${nowMark.atFraction * 100}%` }} />
            )}
          </>
        )}
      />
    </div>
  )
}
