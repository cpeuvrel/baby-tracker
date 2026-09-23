import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { addBaby } from '../repositories/babies'
import type { BabySex } from '../types/models'

export function AddChildPage() {
  const { household } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<BabySex | null>(null)

  if (!household) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '' || sex === null) return
    void addBaby(household.id, name.trim(), birthDate, sex).then(() => navigate('/account/family'))
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate('/account/family')}>
          ‹
        </button>
        <h2>Add Child</h2>
        <button type="submit" className="modal-header-action">
          Save
        </button>
      </div>

      <div>
        <label htmlFor="add-child-name">First Name</label>
        <input
          id="add-child-name"
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
        <label htmlFor="add-child-birth-date">Birthdate</label>
        <input
          id="add-child-birth-date"
          type="date"
          required
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
        />
      </div>
    </form>
  )
}
