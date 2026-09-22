import { useEffect, useState, type FormEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { updateBaby } from '../repositories/babies'
import type { BabySex } from '../types/models'

export function SettingsSection() {
  const { household, selectedBaby } = useHousehold()
  const [unit, setUnit] = useUnitPreference()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<BabySex | null>(null)

  useEffect(() => {
    if (selectedBaby) {
      setName(selectedBaby.name)
      setBirthDate(selectedBaby.birthDate)
      setSex(selectedBaby.sex)
    }
  }, [selectedBaby])

  if (!household || !selectedBaby) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '') return
    void updateBaby(household.id, selectedBaby.id, name.trim(), birthDate, sex)
  }

  return (
    <section aria-label="Settings">
      <h2>Settings</h2>

      <div role="group" aria-label="Unit">
        <button type="button" aria-pressed={unit === 'metric'} onClick={() => setUnit('metric')}>
          Metric (kg/cm)
        </button>
        <button
          type="button"
          aria-pressed={unit === 'imperial'}
          onClick={() => setUnit('imperial')}
        >
          Imperial (lb/in)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="settings-baby-name">Baby's first name</label>
          <input
            id="settings-baby-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="settings-baby-birth-date">Date of birth</label>
          <input
            id="settings-baby-birth-date"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <div role="group" aria-label="Sex">
          <button type="button" aria-pressed={sex === 'female'} onClick={() => setSex('female')}>
            Girl
          </button>
          <button type="button" aria-pressed={sex === 'male'} onClick={() => setSex('male')}>
            Boy
          </button>
        </div>
        <p className="hint">Used to show the right WHO growth percentile curves.</p>
        <button type="submit">Save profile</button>
      </form>
    </section>
  )
}
