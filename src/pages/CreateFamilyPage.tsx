import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createHouseholdWithBaby } from '../repositories/households'
import type { BabySex } from '../types/models'

export function CreateFamilyPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<BabySex | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '' || sex === null) return
    setSubmitting(true)
    setError(null)
    try {
      // On success the household listener switches the app to the new family.
      await createHouseholdWithBaby(user.uid, { name: name.trim(), birthDate, sex })
    } catch (cause) {
      console.error('[family] creation failed', cause)
      setError('Could not create your family. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Welcome to Baby Tracker</h1>
      <p>Add your first child to get started.</p>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label htmlFor="create-family-child-name">First Name</label>
          <input
            id="create-family-child-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div role="group" aria-label="Sex" className="segmented-control">
          <button type="button" aria-pressed={sex === 'male'} onClick={() => setSex('male')}>
            Boy
          </button>
          <button type="button" aria-pressed={sex === 'female'} onClick={() => setSex('female')}>
            Girl
          </button>
        </div>

        <div>
          <label htmlFor="create-family-child-birth-date">Birthdate</label>
          <input
            id="create-family-child-birth-date"
            type="date"
            required
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          Add child
        </button>
      </form>
    </main>
  )
}
