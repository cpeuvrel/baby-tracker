import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { GRAMS_PER_POUND, MM_PER_INCH } from '../lib/growthMetrics'
import { addGrowthEntry } from '../repositories/growthEntries'

interface GrowthFormProps {
  onSaved: () => void
}

export function GrowthForm({ onSaved }: GrowthFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [unit] = useUnitPreference()
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [headCircumference, setHeadCircumference] = useState('')

  if (!household || !selectedBaby || !user) return null

  const weightUnitToGrams = unit === 'imperial' ? GRAMS_PER_POUND : 1000
  const lengthUnitToMm = unit === 'imperial' ? MM_PER_INCH : 10

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void addGrowthEntry(household.id, selectedBaby.id, user.uid, {
      weightG: weight.trim() === '' ? null : Math.round(Number(weight) * weightUnitToGrams),
      heightMm: height.trim() === '' ? null : Math.round(Number(height) * lengthUnitToMm),
      headCircumferenceMm:
        headCircumference.trim() === ''
          ? null
          : Math.round(Number(headCircumference) * lengthUnitToMm),
    })
    onSaved()
  }

  const weightLabel = unit === 'imperial' ? 'Poids (lb)' : 'Poids (kg)'
  const heightLabel = unit === 'imperial' ? 'Taille (in)' : 'Taille (cm)'
  const headLabel =
    unit === 'imperial' ? 'Périmètre crânien (in)' : 'Périmètre crânien (cm)'

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="growth-weight">{weightLabel}</label>
        <input
          id="growth-weight"
          type="number"
          step="0.01"
          min="0"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="growth-height">{heightLabel}</label>
        <input
          id="growth-height"
          type="number"
          step="0.1"
          min="0"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="growth-head">{headLabel}</label>
        <input
          id="growth-head"
          type="number"
          step="0.1"
          min="0"
          value={headCircumference}
          onChange={(event) => setHeadCircumference(event.target.value)}
        />
      </div>
      <button type="submit">Enregistrer</button>
    </form>
  )
}
