import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { deleteFeedingEntry, logFeeding, updateFeedingEntry } from '../repositories/feedingEntries'
import type { FeedingEntry, FeedingType } from '../types/models'
import { Modal } from './Modal'

interface FeedingFormProps {
  entry?: FeedingEntry
  onClose: () => void
}

export function FeedingForm({ entry, onClose }: FeedingFormProps) {
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

  const submit = () => {
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
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Delete this entry?')) return
    void deleteFeedingEntry(household.id, selectedBaby.id, entry.id)
    onClose()
  }

  return (
    <Modal
      title="Feed"
      bandColorVar="--category-feeding"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: submit }}
    >
      <form onSubmit={handleSubmit}>
        <div role="group" aria-label="Type">
          <button type="button" aria-pressed={type === 'bottle'} onClick={() => setType('bottle')}>
            Bottle
          </button>
          <button type="button" aria-pressed={type === 'solid'} onClick={() => setType('solid')}>
            Solid
          </button>
        </div>
        <div>
          <label htmlFor="feeding-occurred-at">Time</label>
          <input
            id="feeding-occurred-at"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </div>
        {type === 'bottle' ? (
          <div>
            <label htmlFor="feeding-volume">Volume (mL, optional)</label>
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
            <label htmlFor="feeding-food-type">Food (optional)</label>
            <input
              id="feeding-food-type"
              type="text"
              value={foodType}
              onChange={(event) => setFoodType(event.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="feeding-notes">Notes (optional)</label>
          <input
            id="feeding-notes"
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
