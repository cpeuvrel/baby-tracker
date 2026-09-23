import { useState } from 'react'
import { GrowthLineChart, type GrowthPoint } from '../components/charts/GrowthLineChart'
import { useHousehold } from '../contexts/HouseholdContext'
import { useGrowthEntries } from '../hooks/useGrowthEntries'
import { useUnitPreference } from '../hooks/useUnitPreference'
import {
  formatGrowthValue,
  GROWTH_METRIC_FIELD,
  GROWTH_METRIC_LABELS,
  type GrowthMetric,
} from '../lib/growthMetrics'

export function GrowthPage() {
  const { household, selectedBaby } = useHousehold()
  const entries = useGrowthEntries(household?.id ?? null, selectedBaby?.id ?? null)
  const [metric, setMetric] = useState<GrowthMetric>('weight')
  const [unit] = useUnitPreference()

  if (!household || !selectedBaby) return null

  const chartData: GrowthPoint[] = entries
    .map((entry) => ({ measuredAt: entry.measuredAt, value: entry[GROWTH_METRIC_FIELD[metric]] }))
    .filter((point): point is GrowthPoint => typeof point.value === 'number')

  return (
    <section aria-label="Growth chart">
      <h2>Growth</h2>
      <div role="group" aria-label="Displayed measurement">
        {(Object.keys(GROWTH_METRIC_LABELS) as GrowthMetric[]).map((key) => (
          <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>
            {GROWTH_METRIC_LABELS[key]}
          </button>
        ))}
      </div>
      {chartData.length === 0 ? (
        <p>No {GROWTH_METRIC_LABELS[metric].toLowerCase()} measurements recorded yet.</p>
      ) : (
        <GrowthLineChart
          data={chartData}
          formatValue={(value) => formatGrowthValue(metric, value, unit)}
        />
      )}
    </section>
  )
}
