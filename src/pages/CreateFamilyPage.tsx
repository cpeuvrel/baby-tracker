import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { addBaby } from '../repositories/babies'
import { createHousehold } from '../repositories/households'
import type { BabySex } from '../types/models'

export function CreateFamilyPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<BabySex | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '' || sex === null) return
    setSubmitting(true)
    const householdId = await createHousehold(user.uid)
    await addBaby(householdId, name.trim(), birthDate, sex)
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

        <button type="submit" disabled={submitting}>
          Add child
        </button>
      </form>
    </main>
  )
}
