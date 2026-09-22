import { useState } from 'react'
import { GrowthLineChart, type GrowthPoint } from '../components/charts/GrowthLineChart'
import { useHousehold } from '../contexts/HouseholdContext'
import { useGrowthEntries } from '../hooks/useGrowthEntries'
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

  if (!household || !selectedBaby) return null

  const chartData: GrowthPoint[] = entries
    .map((entry) => ({ measuredAt: entry.measuredAt, value: entry[GROWTH_METRIC_FIELD[metric]] }))
    .filter((point): point is GrowthPoint => typeof point.value === 'number')

  return (
    <section aria-label="Courbe de croissance">
      <h2>Croissance</h2>
      <div role="group" aria-label="Mesure affichée">
        {(Object.keys(GROWTH_METRIC_LABELS) as GrowthMetric[]).map((key) => (
          <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>
            {GROWTH_METRIC_LABELS[key]}
          </button>
        ))}
      </div>
      {chartData.length === 0 ? (
        <p>Aucune mesure enregistrée pour {GROWTH_METRIC_LABELS[metric].toLowerCase()}.</p>
      ) : (
        <GrowthLineChart data={chartData} formatValue={(value) => formatGrowthValue(metric, value)} />
      )}
    </section>
  )
}
