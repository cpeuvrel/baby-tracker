import { useMemo, useRef, useState, type TouchEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { addDays, formatDate, startOfDay, zonedParts } from '../lib/appTime'
import { ALL_ENTRY_KINDS, type EntryKind } from '../lib/historyFilters'
import { dayKey, dayOfMonth, parseDayKey } from '../lib/timeline'
import { buildWeekBlocks, buildWeekMarks, nightFractions } from '../lib/weekTimeline'
import type { DateRange } from '../lib/timeline'

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const MIN_VISIBLE_BLOCK_MS = 60_000
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
/** Horizontal distance a touch must travel to count as a week swipe. */
const SWIPE_MIN_PX = 50

function startOfWeek(reference: Date): Date {
  const isoWeekday = (zonedParts(reference).weekday + 6) % 7 // Monday = 0
  return addDays(startOfDay(reference), -isoWeekday)
}

function weekDayKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(weekStart, i)))
}

interface WeekTimelineChartProps {
  onSelectDay: (date: Date) => void
  selectedDayKey: string
  visibleKinds?: Set<EntryKind>
  showChart?: boolean
}

export function WeekTimelineChart({
  onSelectDay,
  selectedDayKey,
  visibleKinds = ALL_ENTRY_KINDS,
  showChart = true,
}: WeekTimelineChartProps) {
  const { household, selectedBaby } = useHousehold()
  const [weekOffset, setWeekOffset] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const canGoNext = weekOffset < 0
  const goToPreviousWeek = () => setWeekOffset((v) => v - 1)
  const goToNextWeek = () => setWeekOffset((v) => Math.min(0, v + 1))

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset])
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart])
  const range: DateRange = useMemo(() => ({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const { feeding, sleep, diaper, medication, bath } = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    range,
  )

  const sleepBlocksByDay = useMemo(
    () =>
      buildWeekBlocks(
        dayKeys,
        sleep.map((entry) => {
          const start = new Date(entry.startedAt)
          const end = entry.endedAt
            ? new Date(entry.endedAt)
            : new Date(Math.max(Date.now(), start.getTime() + MIN_VISIBLE_BLOCK_MS))
          return { start, end }
        }),
      ),
    [dayKeys, sleep],
  )
  const feedMarksByDay = useMemo(
    () => buildWeekMarks(dayKeys, feeding.map((entry) => new Date(entry.occurredAt))),
    [dayKeys, feeding],
  )
  const diaperMarksByDay = useMemo(
    () => buildWeekMarks(dayKeys, diaper.map((entry) => new Date(entry.occurredAt))),
    [dayKeys, diaper],
  )
  const medicationMarksByDay = useMemo(
    () => buildWeekMarks(dayKeys, medication.map((entry) => new Date(entry.givenAt))),
    [dayKeys, medication],
  )
  const bathMarksByDay = useMemo(
    () => buildWeekMarks(dayKeys, bath.map((entry) => new Date(entry.occurredAt))),
    [dayKeys, bath],
  )

  if (!household || !selectedBaby) return null

  const todayKey = dayKey(new Date())
  const currentYear = zonedParts(new Date()).year
  const nightBands = nightFractions(selectedBaby.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS)

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current
    touchStart.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx > 0) goToPreviousWeek()
    else if (canGoNext) goToNextWeek()
  }

  return (
    <section
      aria-label="Week calendar"
      className="week-chart"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="week-chart-row week-chart-months">
        <span />
        {dayKeys.map((key, index) => {
          if (index !== 0 && dayOfMonth(key) !== 1) return <span key={key} />
          const date = parseDayKey(key)
          const sameYear = zonedParts(date).year === currentYear
          const label = formatDate(date, sameYear ? { month: 'short' } : { month: 'short', year: 'numeric' })
          return (
            <span key={key} className="week-chart-month-tab">
              {label}
            </span>
          )
        })}
        {canGoNext && (
          <button
            type="button"
            className="week-chart-nav-button week-chart-nav-next"
            aria-label="Next week"
            onClick={goToNextWeek}
          >
            ›
          </button>
        )}
      </div>

      <div className="week-chart-row week-chart-days">
        <button type="button" className="week-chart-nav-button" aria-label="Previous week" onClick={goToPreviousWeek}>
          ‹
        </button>
        {dayKeys.map((key, index) => {
          const date = parseDayKey(key)
          const isToday = key === todayKey
          const isSelected = key === selectedDayKey
          return (
            <button
              key={key}
              type="button"
              className={`week-chart-day-header${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              onClick={() => onSelectDay(date)}
              aria-label={`See details for ${formatDate(date)}`}
            >
              <span>{DAY_LABELS[index]}</span>
              <span className="week-chart-day-number">{dayOfMonth(key)}</span>
            </button>
          )
        })}
      </div>

      {showChart && (
        <div className="week-chart-row week-chart-body">
          {nightBands.map((band) => (
            <span
              key={band.start}
              className="week-chart-night"
              style={{ top: `${band.start * 100}%`, height: `${(band.end - band.start) * 100}%` }}
            />
          ))}
          {HOUR_LABELS.slice(1, -1).map((hour) => (
            <span key={hour} className="week-chart-gridline" style={{ top: `${(hour / 24) * 100}%` }} />
          ))}
          <div className="week-chart-axis">
            {HOUR_LABELS.map((hour) => (
              <span key={hour}>{String(hour).padStart(2, '0')}</span>
            ))}
          </div>
          {dayKeys.map((key) => (
            <div key={key} className="week-chart-column">
              {visibleKinds.has('sleep') &&
                sleepBlocksByDay[key]?.map((block, blockIndex) => (
                  <span
                    key={blockIndex}
                    className="week-chart-block"
                    style={{
                      top: `${block.startFraction * 100}%`,
                      height: `${(block.endFraction - block.startFraction) * 100}%`,
                      background: 'var(--category-sleep)',
                    }}
                  />
                ))}
              {visibleKinds.has('feeding') &&
                feedMarksByDay[key]?.map((mark, markIndex) => (
                  <span
                    key={markIndex}
                    className="week-chart-mark"
                    style={{ top: `${mark.atFraction * 100}%`, background: 'var(--category-feeding)' }}
                  />
                ))}
              {visibleKinds.has('diaper') &&
                diaperMarksByDay[key]?.map((mark, markIndex) => (
                  <span
                    key={markIndex}
                    className="week-chart-mark"
                    style={{ top: `${mark.atFraction * 100}%`, background: 'var(--category-diaper)' }}
                  />
                ))}
              {visibleKinds.has('medication') &&
                medicationMarksByDay[key]?.map((mark, markIndex) => (
                  <span
                    key={markIndex}
                    className="week-chart-mark"
                    style={{ top: `${mark.atFraction * 100}%`, background: 'var(--category-medication)' }}
                  />
                ))}
              {visibleKinds.has('bath') &&
                bathMarksByDay[key]?.map((mark, markIndex) => (
                  <span
                    key={markIndex}
                    className="week-chart-mark"
                    style={{ top: `${mark.atFraction * 100}%`, background: 'var(--category-routine)' }}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
