import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { DailyPoint } from '../lib/aggregations'
import { dayKey, parseDayKey } from '../lib/timeline'
import type { TrendChartStyle } from '../lib/trendMetrics'

interface MetricGraphProps {
  data: DailyPoint[]
  average: number
  ticks: number[]
  chartStyle: TrendChartStyle
  colorVar: string
  icon: ReactNode
  seriesLabel: string
  formatValue: (value: number) => string
  formatTick: (value: number) => string
  /** Called with the day key when a day's column is tapped. */
  onSelectDay: (dayKey: string) => void
  /** Show the previous / next period (swipe or arrows); omitted when there is none. */
  onPrevious?: () => void
  onNext?: () => void
}

const SWIPE_THRESHOLD_PX = 50

function formatWeekday(key: string): string {
  return parseDayKey(key).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)
}

function formatMonth(key: string): string {
  return parseDayKey(key).toLocaleDateString('en-US', { month: 'short' })
}

function formatLongDay(key: string): string {
  return parseDayKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Per-day graph of a trend metric: one column per day under a weekday/date header,
 * a plain bar for quantities or one block per unit for counts, and a dashed AVG line.
 * Tapping a date in the header selects that day (highlighted, value shown in the legend);
 * tapping a day's column calls `onSelectDay` (the page opens that day's entries).
 * Swiping right / left (or the arrows) moves to the previous / next period.
 */
export function MetricGraph({
  data,
  average,
  ticks,
  chartStyle,
  colorVar,
  icon,
  seriesLabel,
  formatValue,
  formatTick,
  onSelectDay,
  onPrevious,
  onNext,
}: MetricGraphProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const swipeStartX = useRef<number | null>(null)
  const swiped = useRef(false)
  const todayKey = dayKey(new Date())
  const max = ticks[ticks.length - 1] || 1
  const percent = (value: number) => `${Math.min(value / max, 1) * 100}%`
  const color = `var(${colorVar})`
  const selected = data.find((point) => point.dayKey === selectedKey)
  const months = [...new Set(data.map((point) => formatMonth(point.dayKey)))]
  const month = months.length > 1 ? `${months[0]} – ${months[months.length - 1]}` : (months[0] ?? '')

  const handlePointerDown = (event: PointerEvent) => {
    swipeStartX.current = event.clientX
    swiped.current = false
  }
  const handlePointerUp = (event: PointerEvent) => {
    if (swipeStartX.current == null) return
    const dx = event.clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    swiped.current = true
    if (dx > 0) onPrevious?.()
    else onNext?.()
  }
  /** Ignores the click that ends a swipe. */
  const unlessSwiped = (action: () => void) => () => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    action()
  }

  return (
    <div
      className="metric-graph"
      aria-label="Metric graph"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (swipeStartX.current = null)}
    >
      <div className="metric-graph-nav">
        <button type="button" aria-label="Previous period" disabled={!onPrevious} onClick={onPrevious}>
          ‹
        </button>
        <span className="metric-graph-month">{month}</span>
        <button type="button" aria-label="Next period" disabled={!onNext} onClick={onNext}>
          ›
        </button>
      </div>

      <div className="metric-graph-header">
        <span className="metric-graph-axis-spacer" />
        {data.map((point) => {
          const highlighted = selectedKey ? point.dayKey === selectedKey : point.dayKey === todayKey
          return (
            <button
              key={point.dayKey}
              type="button"
              className={`metric-graph-day${point.dayKey === todayKey ? ' is-today' : ''}${
                highlighted ? ' is-selected' : ''
              }`}
              aria-label={formatLongDay(point.dayKey)}
              aria-pressed={point.dayKey === selectedKey}
              onClick={unlessSwiped(() => setSelectedKey(point.dayKey === selectedKey ? null : point.dayKey))}
            >
              <span>{formatWeekday(point.dayKey)}</span>
              <span className="metric-graph-day-number">{parseDayKey(point.dayKey).getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="metric-graph-body">
        <div className="metric-graph-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: percent(tick) }}>
              {formatTick(tick)}
            </span>
          ))}
        </div>

        <div className="metric-graph-plot">
          {ticks.slice(1).map((tick) => (
            <span key={tick} className="metric-graph-gridline" style={{ bottom: percent(tick) }} />
          ))}

          {data.map((point) => (
            <button
              key={point.dayKey}
              type="button"
              className={`metric-graph-column${point.dayKey === selectedKey ? ' is-selected' : ''}`}
              aria-label={`${formatLongDay(point.dayKey)}: ${formatValue(point.value)}`}
              onClick={unlessSwiped(() => onSelectDay(point.dayKey))}
            >
              {chartStyle === 'bar' ? (
                point.value > 0 && (
                  <span className="metric-graph-bar" style={{ height: percent(point.value), background: color }} />
                )
              ) : (
                <span className="metric-graph-stack" style={{ height: percent(Math.round(point.value)) }}>
                  {Array.from({ length: Math.round(point.value) }, (_, index) => (
                    <span key={index} className="metric-graph-block" style={{ background: color }} />
                  ))}
                </span>
              )}
            </button>
          ))}

          {average > 0 && (
            <span className="metric-graph-average" style={{ bottom: percent(average) }}>
              <span className="metric-graph-average-label">AVG</span>
            </span>
          )}
        </div>
      </div>

      <p className="metric-graph-legend">
        <span className="metric-graph-legend-icon" style={{ background: color }}>
          {icon}
        </span>
        <span>{selected ? formatLongDay(selected.dayKey) : seriesLabel}</span>
        <strong>{formatValue(selected ? selected.value : average)}</strong>
      </p>
    </div>
  )
}
