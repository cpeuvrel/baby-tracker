import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { parseOptionalPositive } from '../lib/numberInput'
import { reportWriteError } from '../lib/reportWriteError'
import { deleteFeedingEntry, logFeeding, updateFeedingEntry } from '../repositories/feedingEntries'
import type { FeedingEntry, FeedingType } from '../types/models'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

const FORM_ID = 'feeding-form'

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
  const [volumeInvalid, setVolumeInvalid] = useState(false)

  if (!household || !selectedBaby || !user) return null

  const submit = () => {
    if (!occurredAt) return
    const volume = type === 'bottle' ? parseOptionalPositive(volumeMl) : null
    if (volume === 'invalid') {
      setVolumeInvalid(true)
      return
    }
    const input = {
      type,
      occurredAt: fromDatetimeLocalValue(occurredAt),
      volumeMl: volume,
      foodType: type === 'solid' && foodType.trim() !== '' ? foodType.trim() : null,
      notes,
    }
    if (entry) {
      updateFeedingEntry(household.id, selectedBaby.id, entry.id, input).catch(reportWriteError('save the feeding'))
    } else {
      logFeeding(household.id, selectedBaby.id, user.uid, input).catch(reportWriteError('save the feeding'))
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
    deleteFeedingEntry(household.id, selectedBaby.id, entry.id).catch(reportWriteError('delete the feeding'))
    onClose()
  }

  return (
    <Modal
      title="Feed"
      bandColorVar="--category-feeding"
      onClose={onClose}
      headerAction={{ label: 'Save', formId: FORM_ID }}
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <div role="group" aria-label="Type">
          <button type="button" aria-pressed={type === 'bottle'} onClick={() => setType('bottle')}>
            Bottle
          </button>
          <button type="button" aria-pressed={type === 'solid'} onClick={() => setType('solid')}>
            Solid
          </button>
        </div>
        <DateTimeField id="feeding-occurred-at" label="Time" value={occurredAt} onChange={setOccurredAt} />
        {!occurredAt && (
          <p role="alert" className="form-error">
            Pick a date.
          </p>
        )}
        {type === 'bottle' ? (
          <div>
            <label htmlFor="feeding-volume">Volume (mL, optional)</label>
            <input
              id="feeding-volume"
              type="number"
              min="0"
              inputMode="numeric"
              value={volumeMl}
              aria-invalid={volumeInvalid || undefined}
              // The browser refuses a negative before onSubmit: say why under the field.
              onInvalid={() => setVolumeInvalid(true)}
              onChange={(event) => {
                setVolumeMl(event.target.value)
                setVolumeInvalid(false)
              }}
            />
            {volumeInvalid && (
              <p role="alert" className="form-error">
                Enter a volume above 0, or leave it empty.
              </p>
            )}
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
