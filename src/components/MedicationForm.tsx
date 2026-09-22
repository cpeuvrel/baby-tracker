import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import {
  deleteMedicationEntry,
  logMedication,
  updateMedicationEntry,
} from '../repositories/medicationEntries'
import type { MedicationEntry } from '../types/models'

const DEFAULT_MEDICATION_NAME = 'Vitamine D'

interface MedicationFormProps {
  entry?: MedicationEntry
  onSaved: () => void
}

export function MedicationForm({ entry, onSaved }: MedicationFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [name, setName] = useState(entry?.name ?? DEFAULT_MEDICATION_NAME)
  const [givenAt, setGivenAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.givenAt) : new Date()),
  )
  const [dose, setDose] = useState(entry?.dose ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')

  if (!household || !selectedBaby || !user) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '') return
    const input = { name: name.trim(), givenAt: new Date(givenAt), dose, notes }
    if (entry) {
      void updateMedicationEntry(household.id, selectedBaby.id, entry.id, input)
    } else {
      void logMedication(household.id, selectedBaby.id, user.uid, input)
    }
    onSaved()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Supprimer cette entrée ?')) return
    void deleteMedicationEntry(household.id, selectedBaby.id, entry.id)
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
      {entry && (
        <button type="button" className="button-delete" onClick={handleDelete}>
          Supprimer
        </button>
      )}
    </form>
  )
}
