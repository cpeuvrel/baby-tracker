import { useState, type ReactNode } from 'react'
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
}

function formatWeekday(key: string): string {
  return parseDayKey(key).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)
}

function formatLongDay(key: string): string {
  return parseDayKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Per-day graph of a trend metric: one column per day under a weekday/date header,
 * a plain bar for quantities or one block per unit for counts, and a dashed AVG line.
 * Tapping a column shows that day's value in the legend.
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
}: MetricGraphProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const todayKey = dayKey(new Date())
  const max = ticks[ticks.length - 1] || 1
  const percent = (value: number) => `${Math.min(value / max, 1) * 100}%`
  const color = `var(${colorVar})`
  const selected = data.find((point) => point.dayKey === selectedKey)
  const month = data.length > 0 ? parseDayKey(data[0].dayKey).toLocaleDateString('en-US', { month: 'short' }) : ''

  return (
    <div className="metric-graph" aria-label="Metric graph">
      <div className="metric-graph-month">{month}</div>

      <div className="metric-graph-header">
        <span className="metric-graph-axis-spacer" />
        {data.map((point) => (
          <span
            key={point.dayKey}
            className={`metric-graph-day${point.dayKey === todayKey ? ' is-today' : ''}${
              point.dayKey === selectedKey ? ' is-selected' : ''
            }`}
          >
            <span>{formatWeekday(point.dayKey)}</span>
            <span className="metric-graph-day-number">{parseDayKey(point.dayKey).getDate()}</span>
          </span>
        ))}
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
              aria-pressed={point.dayKey === selectedKey}
              onClick={() => setSelectedKey(point.dayKey === selectedKey ? null : point.dayKey)}
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
