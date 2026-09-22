import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { deleteFeedingEntry, logFeeding, updateFeedingEntry } from '../repositories/feedingEntries'
import type { FeedingEntry, FeedingType } from '../types/models'

interface FeedingFormProps {
  entry?: FeedingEntry
  onSaved: () => void
}

export function FeedingForm({ entry, onSaved }: FeedingFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [type, setType] = useState<FeedingType>(entry?.type ?? 'bottle')
  const [occurredAt, setOccurredAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.occurredAt) : new Date()),
  )
  const [volumeMl, setVolumeMl] = useState(entry?.volumeMl != null ? String(entry.volumeMl) : '')
  const [foodType, setFoodType] = useState(entry?.foodType ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')

  if (!household || !selectedBaby || !user) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = {
      type,
      occurredAt: new Date(occurredAt),
      volumeMl: type === 'bottle' && volumeMl.trim() !== '' ? Number(volumeMl) : null,
      foodType: type === 'solid' && foodType.trim() !== '' ? foodType.trim() : null,
      notes,
    }
    if (entry) {
      void updateFeedingEntry(household.id, selectedBaby.id, entry.id, input)
    } else {
      void logFeeding(household.id, selectedBaby.id, user.uid, input)
    }
    onSaved()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Supprimer cette entrée ?')) return
    void deleteFeedingEntry(household.id, selectedBaby.id, entry.id)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div role="group" aria-label="Type">
        <button type="button" aria-pressed={type === 'bottle'} onClick={() => setType('bottle')}>
          Biberon
        </button>
        <button type="button" aria-pressed={type === 'solid'} onClick={() => setType('solid')}>
          Solide
        </button>
      </div>
      <div>
        <label htmlFor="feeding-occurred-at">Heure</label>
        <input
          id="feeding-occurred-at"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
        />
      </div>
      {type === 'bottle' ? (
        <div>
          <label htmlFor="feeding-volume">Volume (mL, optionnel)</label>
          <input
            id="feeding-volume"
            type="number"
            min="0"
            inputMode="numeric"
            value={volumeMl}
            onChange={(event) => setVolumeMl(event.target.value)}
          />
        </div>
      ) : (
        <div>
          <label htmlFor="feeding-food-type">Aliment (optionnel)</label>
          <input
            id="feeding-food-type"
            type="text"
            value={foodType}
            onChange={(event) => setFoodType(event.target.value)}
          />
        </div>
      )}
      <div>
        <label htmlFor="feeding-notes">Notes (optionnel)</label>
        <input
          id="feeding-notes"
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
