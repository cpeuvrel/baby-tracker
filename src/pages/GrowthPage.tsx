import { useState, type FormEvent } from 'react'
import { GrowthLineChart, type GrowthPoint } from '../components/charts/GrowthLineChart'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useGrowthEntries } from '../hooks/useGrowthEntries'
import { addGrowthEntry } from '../repositories/growthEntries'
import type { GrowthEntry } from '../types/models'

type Metric = 'weight' | 'height' | 'headCircumference'

const METRIC_LABELS: Record<Metric, string> = {
  weight: 'Poids',
  height: 'Taille',
  headCircumference: 'Périmètre crânien',
}

const METRIC_FIELD: Record<Metric, keyof GrowthEntry> = {
  weight: 'weightG',
  height: 'heightMm',
  headCircumference: 'headCircumferenceMm',
}

function formatWeight(valueG: number): string {
  return `${(valueG / 1000).toFixed(2)} kg`
}

function formatLengthMm(valueMm: number): string {
  return `${(valueMm / 10).toFixed(1)} cm`
}

export function GrowthPage() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const entries = useGrowthEntries(household?.id ?? null, selectedBaby?.id ?? null)
  const [metric, setMetric] = useState<Metric>('weight')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState('')

  if (!household || !selectedBaby || !user) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void addGrowthEntry(household.id, selectedBaby.id, user.uid, {
      weightG: weightKg.trim() === '' ? null : Math.round(Number(weightKg) * 1000),
      heightMm: heightCm.trim() === '' ? null : Math.round(Number(heightCm) * 10),
      headCircumferenceMm:
        headCircumferenceCm.trim() === '' ? null : Math.round(Number(headCircumferenceCm) * 10),
    })
    setWeightKg('')
    setHeightCm('')
    setHeadCircumferenceCm('')
  }

  const formatValue = metric === 'weight' ? formatWeight : formatLengthMm
  const chartData: GrowthPoint[] = entries
    .map((entry) => ({ measuredAt: entry.measuredAt, value: entry[METRIC_FIELD[metric]] }))
    .filter((point): point is GrowthPoint => typeof point.value === 'number')

  return (
    <div>
      <section aria-label="Ajouter une mesure">
        <h2>Nouvelle mesure</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="weight-kg">Poids (kg)</label>
            <input
              id="weight-kg"
              type="number"
              step="0.01"
              min="0"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="height-cm">Taille (cm)</label>
            <input
              id="height-cm"
              type="number"
              step="0.1"
              min="0"
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="head-cm">Périmètre crânien (cm)</label>
            <input
              id="head-cm"
              type="number"
              step="0.1"
              min="0"
              value={headCircumferenceCm}
              onChange={(event) => setHeadCircumferenceCm(event.target.value)}
            />
          </div>
          <button type="submit">Enregistrer</button>
        </form>
      </section>

      <section aria-label="Courbe de croissance">
        <h2>Courbe</h2>
        <div role="group" aria-label="Mesure affichée">
          {(Object.keys(METRIC_LABELS) as Metric[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {METRIC_LABELS[key]}
            </button>
          ))}
        </div>
        {chartData.length === 0 ? (
          <p>Aucune mesure enregistrée pour {METRIC_LABELS[metric].toLowerCase()}.</p>
        ) : (
          <GrowthLineChart data={chartData} formatValue={formatValue} />
        )}
      </section>
    </div>
  )
}
