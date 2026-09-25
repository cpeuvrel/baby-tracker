import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { updateNighttimeHours } from '../repositories/babies'
import { TimeSelect } from '../components/TimeSelect'

export function NighttimeHoursPage() {
  const { babyId } = useParams<{ babyId: string }>()
  const navigate = useNavigate()
  const { household, babies } = useHousehold()
  const baby = babies.find((candidate) => candidate.id === babyId)
  const current = baby?.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS
  const [start, setStart] = useState(current.start)
  const [end, setEnd] = useState(current.end)

  if (!household || !baby) return null

  const backTo = `/account/family/${baby.id}`

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void updateNighttimeHours(household.id, baby.id, { start, end }).then(() => navigate(backTo))
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate(backTo)}>
          ‹
        </button>
        <h2>Nighttime Hours</h2>
        <button type="submit" className="modal-header-action">
          Save
        </button>
      </div>

      <div>
        <span className="field-label">From</span>
        <TimeSelect label="From" value={start} onChange={setStart} />
      </div>
      <div>
        <span className="field-label">To</span>
        <TimeSelect label="To" value={end} onChange={setEnd} />
      </div>
    </form>
  )
}
