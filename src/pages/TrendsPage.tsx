import { useMemo, useState } from 'react'
import { TrendMetricIcon } from '../components/TrendMetricIcon'
import { TrendRow } from '../components/TrendRow'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { computeDelta, DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { dayKeysInRange, dayRange, lastNDaysRange, precedingRange } from '../lib/timeline'
import {
  computeMetricBreakdown,
  computeMetricSummary,
  formatMetricHeadline,
  formatMetricValue,
  TREND_METRICS,
  trendFetchRange,
} from '../lib/trendMetrics'

const RANGE_OPTIONS = [
  { days: 1, label: '1d' },
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
]

const SECTIONS = Array.from(new Set(TREND_METRICS.map((metric) => metric.section)))

export function TrendsPage() {
  const { household, selectedBaby } = useHousehold()
  const [days, setDays] = useState(7)
  const now = useMemo(() => new Date(), [])
  const currentRange = days === 1 ? dayRange(now) : lastNDaysRange(now, days)
  const previousRange = precedingRange(currentRange)

  const nightRange = selectedBaby?.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS

  // Loaded from the night before each period, as a period's first sleep day starts then.
  const current = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    trendFetchRange(currentRange, nightRange),
  )
  const previous = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    trendFetchRange(previousRange, nightRange),
  )

  if (!household || !selectedBaby) return null

  const currentDayKeys = dayKeysInRange(currentRange)
  const previousDayKeys = dayKeysInRange(previousRange)

  return (
    <div className="trends">
      <div role="group" aria-label="Period" className="trend-range">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            aria-pressed={days === option.days}
            onClick={() => setDays(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {SECTIONS.map((section) => (
        <section key={section} className="trend-section" aria-labelledby={`trend-section-${section}`}>
          <h2 id={`trend-section-${section}`} className="trend-section-title">
            {section}
          </h2>
          {TREND_METRICS.filter((metric) => metric.section === section).map((metric) => {
            const currentValue = computeMetricSummary(metric.id, currentDayKeys, current, nightRange)
            const previousValue = computeMetricSummary(metric.id, previousDayKeys, previous, nightRange)
            const delta = computeDelta(currentValue, previousValue)
            const deltaLabel = formatMetricValue(metric.id, Math.abs(delta.value))
            const shownDelta = deltaLabel === formatMetricValue(metric.id, 0) ? { ...delta, direction: 'flat' as const } : delta

            return (
              <TrendRow
                key={metric.id}
                to={`/trends/${metric.id}`}
                icon={<TrendMetricIcon id={metric.id} colorVar={metric.colorVar} />}
                title={metric.title}
                subtitle={formatMetricHeadline(metric.id, currentValue)}
                delta={shownDelta}
                deltaLabel={deltaLabel}
                colorVar={metric.colorVar}
                breakdown={computeMetricBreakdown(metric.id, currentDayKeys, current).map((item) => ({
                  ...item,
                  value: formatMetricValue(metric.id, item.value),
                }))}
              />
            )
          })}
        </section>
      ))}
    </div>
  )
}
