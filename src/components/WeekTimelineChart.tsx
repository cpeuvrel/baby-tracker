import { useCallback, useMemo, useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { addDays, formatDate, startOfDay, zonedParts } from '../lib/appTime'
import { ALL_ENTRY_KINDS, type EntryKind } from '../lib/historyFilters'
import { dayKey, parseDayKey } from '../lib/timeline'
import { buildWeekBlocks, buildWeekMarks, nightFractions } from '../lib/weekTimeline'
import type { DateRange } from '../lib/timeline'
import { TimelineGrid } from './TimelineGrid'

const AXIS_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => String(hour).padStart(2, '0'))
const MIN_VISIBLE_BLOCK_MS = 60_000
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
/** Weeks loaded at first, and added each time the chart is scrolled back to its first week. */
const WEEKS_PER_LOAD = 8
const MAX_WEEKS = 104

function startOfWeek(reference: Date): Date {
  const isoWeekday = (zonedParts(reference).weekday + 6) % 7 // Monday = 0
  return addDays(startOfDay(reference), -isoWeekday)
}

interface WeekTimelineChartProps {
  onSelectDay: (date: Date) => void
  selectedDayKey: string
  visibleKinds?: Set<EntryKind>
  showChart?: boolean
}

/** Weeks side by side, scrolled horizontally one week at a time, the current week first shown. */
export function WeekTimelineChart({
  onSelectDay,
  selectedDayKey,
  visibleKinds = ALL_ENTRY_KINDS,
  showChart = true,
}: WeekTimelineChartProps) {
  const { household, selectedBaby } = useHousehold()
  const [weeks, setWeeks] = useState(WEEKS_PER_LOAD)
  const loadEarlierWeeks = useCallback(
    () => setWeeks((current) => Math.min(MAX_WEEKS, current + WEEKS_PER_LOAD)),
    [],
  )

  const currentWeekStart = useMemo(() => startOfWeek(new Date()), [])
  const range: DateRange = useMemo(
    () => ({ start: addDays(currentWeekStart, -(weeks - 1) * 7), end: addDays(currentWeekStart, 7) }),
    [currentWeekStart, weeks],
  )
  const dayKeys = useMemo(
    () => Array.from({ length: weeks * 7 }, (_, i) => dayKey(addDays(range.start, i))),
    [range, weeks],
  )

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
  const marksByKind = useMemo(
    () => ({
      feeding: buildWeekMarks(dayKeys, feeding.map((entry) => new Date(entry.occurredAt))),
      diaper: buildWeekMarks(dayKeys, diaper.map((entry) => new Date(entry.occurredAt))),
      medication: buildWeekMarks(dayKeys, medication.map((entry) => new Date(entry.givenAt))),
      bath: buildWeekMarks(dayKeys, bath.map((entry) => new Date(entry.occurredAt))),
    }),
    [dayKeys, feeding, diaper, medication, bath],
  )

  if (!household || !selectedBaby) return null

  const markKinds = [
    ['feeding', '--category-feeding'],
    ['diaper', '--category-diaper'],
    ['medication', '--category-medication'],
    ['bath', '--category-routine'],
  ] as const

  return (
    <section aria-label="Week calendar" className="week-chart">
      <TimelineGrid
        dayKeys={dayKeys}
        visibleDays={7}
        scrollable
        onReachStart={weeks < MAX_WEEKS ? loadEarlierWeeks : undefined}
        axisLabels={AXIS_LABELS}
        nightBands={nightFractions(selectedBaby.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS)}
        selectedKey={selectedDayKey}
        todayKey={dayKey(new Date())}
        onSelectDay={(key) => onSelectDay(parseDayKey(key))}
        dayLabel={(key) => `See details for ${formatDate(parseDayKey(key))}`}
        weekdayLabel={(key) => DAY_LABELS[(zonedParts(parseDayKey(key)).weekday + 6) % 7]}
        previousLabel="Previous week"
        nextLabel="Next week"
        showBody={showChart}
        renderColumn={(key) => (
          <>
            {visibleKinds.has('sleep') &&
              sleepBlocksByDay[key]?.map((block, blockIndex) => (
                <span
                  key={`sleep-${blockIndex}`}
                  className="timeline-grid-block"
                  style={{
                    top: `${block.startFraction * 100}%`,
                    height: `${(block.endFraction - block.startFraction) * 100}%`,
                    background: 'var(--category-sleep)',
                  }}
                />
              ))}
            {markKinds.map(([kind, colorVar]) =>
              visibleKinds.has(kind)
                ? marksByKind[kind][key]?.map((mark, markIndex) => (
                    <span
                      key={`${kind}-${markIndex}`}
                      className="timeline-grid-mark"
                      style={{ top: `${mark.atFraction * 100}%`, background: `var(${colorVar})` }}
                    />
                  ))
                : null,
            )}
          </>
        )}
      />
    </section>
  )
}
