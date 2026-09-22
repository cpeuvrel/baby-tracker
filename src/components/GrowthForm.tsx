import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { GRAMS_PER_POUND, MM_PER_INCH } from '../lib/growthMetrics'
import { addGrowthEntry, deleteGrowthEntry, updateGrowthEntry } from '../repositories/growthEntries'
import type { GrowthEntry } from '../types/models'

interface GrowthFormProps {
  entry?: GrowthEntry
  onSaved: () => void
}

export function GrowthForm({ entry, onSaved }: GrowthFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [unit] = useUnitPreference()
  const weightUnitToGrams = unit === 'imperial' ? GRAMS_PER_POUND : 1000
  const lengthUnitToMm = unit === 'imperial' ? MM_PER_INCH : 10
  const [measuredAt, setMeasuredAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.measuredAt) : new Date()),
  )
  const [weight, setWeight] = useState(
    entry?.weightG != null ? String(entry.weightG / weightUnitToGrams) : '',
  )
  const [height, setHeight] = useState(
    entry?.heightMm != null ? String(entry.heightMm / lengthUnitToMm) : '',
  )
  const [headCircumference, setHeadCircumference] = useState(
    entry?.headCircumferenceMm != null ? String(entry.headCircumferenceMm / lengthUnitToMm) : '',
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')

  if (!household || !selectedBaby || !user) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = {
      measuredAt: new Date(measuredAt),
      weightG: weight.trim() === '' ? null : Math.round(Number(weight) * weightUnitToGrams),
      heightMm: height.trim() === '' ? null : Math.round(Number(height) * lengthUnitToMm),
      headCircumferenceMm:
        headCircumference.trim() === ''
          ? null
          : Math.round(Number(headCircumference) * lengthUnitToMm),
      notes,
    }
    if (entry) {
      void updateGrowthEntry(household.id, selectedBaby.id, entry.id, input)
    } else {
      void addGrowthEntry(household.id, selectedBaby.id, user.uid, input)
    }
    onSaved()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Supprimer cette entrée ?')) return
    void deleteGrowthEntry(household.id, selectedBaby.id, entry.id)
    onSaved()
  }

  const weightLabel = unit === 'imperial' ? 'Poids (lb)' : 'Poids (kg)'
  const heightLabel = unit === 'imperial' ? 'Taille (in)' : 'Taille (cm)'
  const headLabel =
    unit === 'imperial' ? 'Périmètre crânien (in)' : 'Périmètre crânien (cm)'

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="growth-measured-at">Heure</label>
        <input
          id="growth-measured-at"
          type="datetime-local"
          value={measuredAt}
          onChange={(event) => setMeasuredAt(event.target.value)}
        />
      </div>
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
      <div>
        <label htmlFor="growth-notes">Notes (optionnel)</label>
        <input
          id="growth-notes"
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <button type="submit">Enregistrer</button>
      {entry && (
        <button type="button" className="button-delete" onClick={handleDelete}>
          Supprimer
        </button>
      )}
    </form>
  )
}
