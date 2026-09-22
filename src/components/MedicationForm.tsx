import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { logMedication } from '../repositories/medicationEntries'

const DEFAULT_MEDICATION_NAME = 'Vitamine D'

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface MedicationFormProps {
  onSaved: () => void
}

export function MedicationForm({ onSaved }: MedicationFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [name, setName] = useState(DEFAULT_MEDICATION_NAME)
  const [givenAt, setGivenAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [dose, setDose] = useState('')
  const [notes, setNotes] = useState('')

  if (!household || !selectedBaby || !user) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '') return
    void logMedication(household.id, selectedBaby.id, user.uid, {
      name: name.trim(),
      givenAt: new Date(givenAt),
      dose,
      notes,
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="medication-name">Médicament</label>
        <input
          id="medication-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="medication-given-at">Heure</label>
        <input
          id="medication-given-at"
          type="datetime-local"
          value={givenAt}
          onChange={(event) => setGivenAt(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="medication-dose">Dose (optionnel)</label>
        <input
          id="medication-dose"
          type="text"
          value={dose}
          onChange={(event) => setDose(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="medication-notes">Notes (optionnel)</label>
        <input
          id="medication-notes"
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <button type="submit">Enregistrer</button>
    </form>
  )
}
