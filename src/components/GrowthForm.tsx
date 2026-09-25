import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { GRAMS_PER_POUND, MM_PER_INCH } from '../lib/growthMetrics'
import { addGrowthEntry, deleteGrowthEntry, updateGrowthEntry } from '../repositories/growthEntries'
import type { GrowthEntry } from '../types/models'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

interface GrowthFormProps {
  entry?: GrowthEntry
  onClose: () => void
}

export function GrowthForm({ entry, onClose }: GrowthFormProps) {
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

  const submit = () => {
    const input = {
      measuredAt: fromDatetimeLocalValue(measuredAt),
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
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Delete this entry?')) return
    void deleteGrowthEntry(household.id, selectedBaby.id, entry.id)
    onClose()
  }

  const weightLabel = unit === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'
  const heightLabel = unit === 'imperial' ? 'Height (in)' : 'Height (cm)'
  const headLabel = unit === 'imperial' ? 'Head Size (in)' : 'Head Size (cm)'

  return (
    <Modal
      title="Growth"
      bandColorVar="--category-growth"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: submit }}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField id="growth-measured-at" label="Time" value={measuredAt} onChange={setMeasuredAt} />
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
          <label htmlFor="growth-notes">Notes (optional)</label>
          <input
            id="growth-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {entry && (
          <button type="button" className="button-delete" onClick={handleDelete}>
            Delete
          </button>
        )}
      </form>
    </Modal>
  )
}
