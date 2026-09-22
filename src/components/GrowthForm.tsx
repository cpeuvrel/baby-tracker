import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { addGrowthEntry } from '../repositories/growthEntries'

interface GrowthFormProps {
  onSaved: () => void
}

export function GrowthForm({ onSaved }: GrowthFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
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
    onSaved()
  }

  return (
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
  )
}
