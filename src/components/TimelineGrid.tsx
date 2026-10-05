import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { formatDate, zonedParts } from '../lib/appTime'
import { dayOfMonth, parseDayKey } from '../lib/timeline'

interface TimelineGridProps {
  dayKeys: string[]
  /** How many day columns fit in the visible width (the rest is reached by scrolling). */
  visibleDays: number
  /** Labels of the hour axis, top to bottom (its first and last mark the column edges). */
  axisLabels: string[]
  /** Night parts of a column as [start, end) fractions, drawn as paler full-width bands. */
  nightBands?: Array<{ start: number; end: number }>
  selectedKey: string | null
  /** Day whose header stands out (e.g. the selected day, else today); defaults to the selected day. */
  highlightKey?: string | null
  onSelectDay: (key: string) => void
  /** Accessible name of a day's header button. */
  dayLabel: (key: string) => string
  /** Two-letter weekday shown above the day number. */
  weekdayLabel: (key: string) => string
  /** Marks the header (and column) buttons as toggles with aria-pressed. */
  pressable?: boolean
  /** Makes the whole column a button selecting its day, with this accessible name. */
  columnLabel?: (key: string) => string
  renderColumn: (key: string) => ReactNode
  showBody?: boolean
  /** Scrolls the days horizontally, snapping on every `visibleDays` columns (one period per swipe at most). */
  scrollable?: boolean
  /** Called when scrolled within one period of the first day (to load earlier days). */
  onReachStart?: () => void
  /** Arrow handlers when not scrollable (scrollable grids scroll by one period instead). */
  onPrevious?: () => void
  onNext?: () => void
  /** Accessible names of the arrows (e.g. "Previous week"). */
  previousLabel?: string
  nextLabel?: string
  todayKey: string
}

interface MonthSegment {
  key: string
  label: string
  days: number
}

function monthSegments(dayKeys: string[], currentYear: number): MonthSegment[] {
  const segments: MonthSegment[] = []
  for (const key of dayKeys) {
    const month = key.slice(0, 7)
    const last = segments[segments.length - 1]
    if (last?.key === month) {
      last.days += 1
      continue
    }
    const date = parseDayKey(key)
    const sameYear = zonedParts(date).year === currentYear
    segments.push({
      key: month,
      label: formatDate(date, sameYear ? { month: 'short' } : { month: 'short', year: 'numeric' }),
      days: 1,
    })
  }
  return segments
}

/**
 * Day columns under a fixed hour axis, with month tabs and day headers on top: shared by the
 * History week chart and the Trends calendar.
 */
export function TimelineGrid({
  dayKeys,
  visibleDays,
  axisLabels,
  nightBands = [],
  selectedKey,
  highlightKey = selectedKey,
  onSelectDay,
  dayLabel,
  weekdayLabel,
  pressable = false,
  columnLabel,
  renderColumn,
  showBody = true,
  scrollable = false,
  onReachStart,
  onPrevious,
  onNext,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  todayKey,
}: TimelineGridProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  /** Distance scrolled from the right end, kept when earlier days are added on the left. */
  const fromEnd = useRef(0)
  const [atEnd, setAtEnd] = useState(true)
  const firstKey = dayKeys[0]

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scrollable || !scroller) return
    scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth - fromEnd.current
  }, [scrollable, firstKey])

  const handleScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    fromEnd.current = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft
    setAtEnd(fromEnd.current < 2)
    if (scroller.scrollLeft < scroller.clientWidth) onReachStart?.()
  }

  const scrollByPeriod = (direction: -1 | 1) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy?.({ left: direction * scroller.clientWidth, behavior: 'smooth' })
  }
  const hasPrevious = scrollable || onPrevious !== undefined
  const hasNext = scrollable ? !atEnd : onNext !== undefined
  const goPrevious = () => (scrollable ? scrollByPeriod(-1) : onPrevious?.())
  const goNext = () => (scrollable ? scrollByPeriod(1) : onNext?.())

  const currentYear = zonedParts(new Date()).year
  const pressed = (key: string) => (pressable ? key === selectedKey : undefined)
  const background = (
    <>
      {nightBands.map((band) => (
        <span
          key={band.start}
          className="timeline-grid-night"
          style={{ top: `${band.start * 100}%`, height: `${(band.end - band.start) * 100}%` }}
        />
      ))}
      {axisLabels.slice(1, -1).map((_, index) => (
        <span
          key={index}
          className="timeline-grid-gridline"
          style={{ top: `${((index + 1) / (axisLabels.length - 1)) * 100}%` }}
        />
      ))}
    </>
  )

  return (
    <div className="timeline-grid">
      <div className="timeline-grid-axis-side">
        <div className="timeline-grid-months" />
        <div className="timeline-grid-days">
          {hasPrevious && (
            <button type="button" className="timeline-grid-nav" aria-label={previousLabel} onClick={goPrevious}>
              ‹
            </button>
          )}
        </div>
        {showBody && (
          <div className="timeline-grid-body">
            {background}
            <div className="timeline-grid-axis">
              {axisLabels.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className={`timeline-grid-scroller${scrollable ? ' is-scrollable' : ''}`}
        onScroll={scrollable ? handleScroll : undefined}
      >
        <div
          className="timeline-grid-track"
          style={{ width: `${(dayKeys.length / visibleDays) * 100}%` }}
        >
          <div className="timeline-grid-months">
            {monthSegments(dayKeys, currentYear).map((segment) => (
              <div
                key={segment.key}
                className="timeline-grid-month"
                style={{ width: `${(segment.days / dayKeys.length) * 100}%` }}
              >
                <span className="timeline-grid-month-tab">{segment.label}</span>
              </div>
            ))}
          </div>
          <div className="timeline-grid-days">
            {dayKeys.map((key, index) => (
              <button
                key={key}
                type="button"
                className={`timeline-grid-day-header${key === highlightKey ? ' is-selected' : ''}${key === todayKey ? ' is-today' : ''}${scrollable && (dayKeys.length - index) % visibleDays === 0 ? ' is-snap' : ''}`}
                aria-label={dayLabel(key)}
                aria-pressed={pressed(key)}
                onClick={() => onSelectDay(key)}
              >
                <span>{weekdayLabel(key)}</span>
                <span className="timeline-grid-day-number">{dayOfMonth(key)}</span>
              </button>
            ))}
          </div>
          {showBody && (
            <div className="timeline-grid-body">
              {background}
              {dayKeys.map((key) =>
                columnLabel ? (
                  <button
                    key={key}
                    type="button"
                    className={`timeline-grid-column is-button${key === selectedKey ? ' is-selected' : ''}`}
                    aria-label={columnLabel(key)}
                    aria-pressed={pressed(key)}
                    onClick={() => onSelectDay(key)}
                  >
                    {renderColumn(key)}
                  </button>
                ) : (
                  <div key={key} className="timeline-grid-column">
                    {renderColumn(key)}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {hasNext && (
        <button type="button" className="timeline-grid-nav timeline-grid-nav-next" aria-label={nextLabel} onClick={goNext}>
          ›
        </button>
      )}
    </div>
  )
}
