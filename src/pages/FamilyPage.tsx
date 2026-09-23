import { useState, type FormEvent } from 'react'
import { ExportImportSection } from '../components/ExportImportSection'
import { SettingsSection } from '../components/SettingsSection'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { formatAge } from '../lib/age'
import { addBaby } from '../repositories/babies'

export function FamilyPage() {
  const { user } = useAuth()
  const { household, babies } = useHousehold()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const now = new Date()

  if (!household) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '') return
    void addBaby(household.id, name.trim(), birthDate)
    setName('')
    setBirthDate('')
  }

  return (
    <div>
      <section aria-label="Children">
        <h2>Children</h2>
        <ul className="list-group">
          {babies.map((baby) => (
            <li key={baby.id}>
              <span>{baby.name}</span>
              <span className="list-group-meta">Age {formatAge(baby.birthDate, now)}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="baby-name">First name</label>
            <input
              id="baby-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="baby-birth-date">Date of birth</label>
            <input
              id="baby-birth-date"
              type="date"
              required
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>
          <button type="submit">Add child</button>
        </form>
      </section>

      <section aria-label="Parents">
        <h2>Caregivers</h2>
        <ul className="list-group">
          <li>
            <span>{user?.email}</span>
            <span className="list-group-meta">Your Profile</span>
          </li>
          {household.memberUids
            .filter((uid) => uid !== user?.uid)
            .map((uid) => (
              <li key={uid}>
                <span>Other caregiver</span>
                <span className="list-group-meta">{uid.slice(0, 8)}…</span>
              </li>
            ))}
        </ul>
        <p className="hint">
          Adding a caregiver is done through the Firebase console (email/password account), not
          from the app.
        </p>
      </section>

      <SettingsSection />
      <ExportImportSection />
    </div>
  )
}
