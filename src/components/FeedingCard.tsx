import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { logFeeding } from '../repositories/feedingEntries'
import type { FeedingType } from '../types/models'

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function FeedingCard() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [type, setType] = useState<FeedingType>('bottle')
  const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [volumeMl, setVolumeMl] = useState('')
  const [foodType, setFoodType] = useState('')
  const [notes, setNotes] = useState('')

  if (!household || !selectedBaby || !user) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void logFeeding(household.id, selectedBaby.id, user.uid, {
      type,
      occurredAt: new Date(occurredAt),
      volumeMl: type === 'bottle' && volumeMl.trim() !== '' ? Number(volumeMl) : null,
      foodType: type === 'solid' && foodType.trim() !== '' ? foodType.trim() : null,
      notes,
    })
    setOccurredAt(toDatetimeLocalValue(new Date()))
    setVolumeMl('')
    setFoodType('')
    setNotes('')
  }

  return (
    <section aria-label="Nourriture">
      <h2>Nourriture</h2>
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
      </form>
    </section>
  )
}
