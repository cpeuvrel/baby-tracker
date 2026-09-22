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
import { Modal } from './Modal'

const DEFAULT_MEDICATION_NAME = 'Vitamin D'

interface MedicationFormProps {
  entry?: MedicationEntry
  onClose: () => void
}

export function MedicationForm({ entry, onClose }: MedicationFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [name, setName] = useState(entry?.name ?? DEFAULT_MEDICATION_NAME)
  const [givenAt, setGivenAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.givenAt) : new Date()),
  )
  const [dose, setDose] = useState(entry?.dose ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')

  if (!household || !selectedBaby || !user) return null

  const submit = () => {
    if (name.trim() === '') return
    const input = { name: name.trim(), givenAt: new Date(givenAt), dose, notes }
    if (entry) {
      void updateMedicationEntry(household.id, selectedBaby.id, entry.id, input)
    } else {
      void logMedication(household.id, selectedBaby.id, user.uid, input)
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
    void deleteMedicationEntry(household.id, selectedBaby.id, entry.id)
    onClose()
  }

  return (
    <Modal
      title="Medication"
      bandColorVar="--category-medication"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: submit }}
    >
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="medication-name">Medication</label>
          <input
            id="medication-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="medication-given-at">Time</label>
          <input
            id="medication-given-at"
            type="datetime-local"
            value={givenAt}
            onChange={(event) => setGivenAt(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="medication-dose">Dose (optional)</label>
          <input
            id="medication-dose"
            type="text"
            value={dose}
            onChange={(event) => setDose(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="medication-notes">Notes (optional)</label>
          <input
            id="medication-notes"
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
