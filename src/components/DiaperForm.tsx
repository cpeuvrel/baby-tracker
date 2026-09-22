import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { logDiaper } from '../repositories/diaperEntries'
import type { DiaperType } from '../types/models'

const DIAPER_TYPES: { value: DiaperType; label: string }[] = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'both', label: 'Both' },
  { value: 'dry', label: 'Dry' },
]

interface DiaperFormProps {
  onSaved: () => void
}

export function DiaperForm({ onSaved }: DiaperFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [notes, setNotes] = useState('')

  if (!household || !selectedBaby || !user) return null

  const handleLog = (type: DiaperType) => {
    void logDiaper(household.id, selectedBaby.id, user.uid, type, notes)
    setNotes('')
    onSaved()
  }

  return (
    <div>
      <label htmlFor="diaper-notes">Notes (optionnel)</label>
      <input
        id="diaper-notes"
        type="text"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div>
        {DIAPER_TYPES.map(({ value, label }) => (
          <button key={value} type="button" onClick={() => handleLog(value)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
