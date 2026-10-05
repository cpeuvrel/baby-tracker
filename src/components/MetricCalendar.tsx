import { useMemo } from 'react'
import { formatDate } from '../lib/appTime'
import { dayKey, parseDayKey } from '../lib/timeline'
import { markForInstant, nightFractions, splitIntervalByDay, type DayBlock, type DayMark } from '../lib/weekTimeline'
import type { NighttimeHours } from '../types/models'
import { TimelineGrid } from './TimelineGrid'

const AXIS_LABELS = ['00', '03', '06', '09', '12', '15', '18', '21', '24']

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
 * One calendar-day column (00 → 24) per day of the period, with the baby's sleeps or events
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
          splitIntervalByDay(start, end).map((block) => ({ ...block, faded })),
        ),
      ),
    [dayKeys, blocks],
  )
  const marksByDay = useMemo(
    () =>
      groupByDay<DayMark & { faded: boolean }>(
        dayKeys,
        marks.map(({ at, faded = false }) => ({ ...markForInstant(at), faded })),
      ),
    [dayKeys, marks],
  )
  const todayKey = dayKey(now)
  const nowMark = markForInstant(now)
  const toggleDay = (key: string) => onSelectDay(key === selectedKey ? null : key)

  return (
    <div className="metric-calendar" aria-label="Metric calendar">
      <TimelineGrid
        dayKeys={dayKeys}
        visibleDays={dayKeys.length}
        axisLabels={AXIS_LABELS}
        nightBands={nightRange ? nightFractions(nightRange) : []}
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
            {key === todayKey && (
              <span className="timeline-grid-now" aria-hidden="true" style={{ top: `${nowMark.atFraction * 100}%` }} />
            )}
          </>
        )}
      />
    </div>
  )
}
