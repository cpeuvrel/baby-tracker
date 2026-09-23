import { useMemo, useState, type ReactNode } from 'react'
import { TrendRow } from '../components/TrendRow'
import { DiaperIcon, FeedIcon, SleepIcon } from '../components/icons'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { averageOfPoints, computeDelta, DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { dayKeysInRange, dayRange, lastNDaysRange, precedingRange } from '../lib/timeline'
import {
  computeMetricSeries,
  formatMetricHeadline,
  formatMetricValue,
  TREND_METRICS,
  type TrendKind,
} from '../lib/trendMetrics'
import { GrowthPage } from './GrowthPage'

const RANGE_OPTIONS = [
  { days: 1, label: '1d' },
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
]

const KIND_ICONS: Record<TrendKind, ReactNode> = {
  feeding: <FeedIcon />,
  sleep: <SleepIcon />,
  diaper: <DiaperIcon />,
}

const SECTIONS = Array.from(new Set(TREND_METRICS.map((metric) => metric.section)))

export function TrendsPage() {
  const { household, selectedBaby } = useHousehold()
  const [days, setDays] = useState(7)
  const now = useMemo(() => new Date(), [])
  const currentRange = days === 1 ? dayRange(now) : lastNDaysRange(now, days)
  const previousRange = precedingRange(currentRange)

  const current = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, currentRange)
  const previous = useEntriesInRange(household?.id ?? null, selectedBaby?.id ?? null, previousRange)

  if (!household || !selectedBaby) return null

  const currentDayKeys = dayKeysInRange(currentRange)
  const previousDayKeys = dayKeysInRange(previousRange)
  const nightRange = selectedBaby.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS

  return (
    <div>
      <div role="group" aria-label="Period">
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
        <div key={section}>
          <h2 className="trend-section-title">{section}</h2>
          {TREND_METRICS.filter((metric) => metric.section === section).map((metric) => {
            const currentAvg = averageOfPoints(
              computeMetricSeries(metric.id, currentDayKeys, current, nightRange),
            )
            const previousAvg = averageOfPoints(
              computeMetricSeries(metric.id, previousDayKeys, previous, nightRange),
            )
            const delta = computeDelta(currentAvg, previousAvg)

            return (
              <TrendRow
                key={metric.id}
                to={`/trends/${metric.id}`}
                icon={KIND_ICONS[metric.kind]}
                title={metric.title}
                subtitle={formatMetricHeadline(metric.id, currentAvg)}
                delta={delta}
                deltaLabel={formatMetricValue(metric.id, Math.abs(delta.value))}
                colorVar={metric.colorVar}
              />
            )
          })}
        </div>
      ))}

      <GrowthPage />
    </div>
  )
}
