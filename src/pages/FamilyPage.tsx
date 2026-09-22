import { useState, type FormEvent } from 'react'
import { ExportImportSection } from '../components/ExportImportSection'
import { useHousehold } from '../contexts/HouseholdContext'
import { addBaby } from '../repositories/babies'

export function FamilyPage() {
  const { household, babies } = useHousehold()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')

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
      <section aria-label="Enfants">
        <h2>Children</h2>
        <ul className="list-group">
          {babies.map((baby) => (
            <li key={baby.id}>
              <span>{baby.name}</span>
              <span className="list-group-meta">{baby.birthDate}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="baby-name">Prénom</label>
            <input
              id="baby-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="baby-birth-date">Date de naissance</label>
            <input
              id="baby-birth-date"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>
          <button type="submit">Add child</button>
        </form>
      </section>

      <section aria-label="Parents">
        <h2>Caregivers</h2>
        <p>
          {household.name} — {household.memberUids.length} parent
          {household.memberUids.length > 1 ? 's' : ''}
        </p>
        <p className="hint">
          L'ajout d'un parent se fait via la console Firebase (compte email/mot de passe), pas
          depuis l'app.
        </p>
      </section>

      <ExportImportSection />
    </div>
  )
}
