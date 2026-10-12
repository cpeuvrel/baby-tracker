import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { ACTIVITY_CATEGORIES, useActivityVisibility } from '../hooks/useActivityVisibility'

export function EditActivitiesPage() {
  const { babyId } = useParams<{ babyId: string }>()
  const navigate = useNavigate()
  const { babies } = useHousehold()
  const { isVisible, toggle } = useActivityVisibility()

  // Unknown child (deleted, stale link): its Back button would lead nowhere.
  if (!babies.some((baby) => baby.id === babyId)) return <Navigate to="/account/family" replace />

  return (
    <div>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate(`/account/family/${babyId}`)}>
          ‹
        </button>
        <h2>Edit Activities</h2>
      </div>

      <ul className="list-group">
        {ACTIVITY_CATEGORIES.map((category) => (
          <li key={category.id}>
            <label htmlFor={`activity-${category.id}`}>{category.label}</label>
            <input
              id={`activity-${category.id}`}
              type="checkbox"
              checked={isVisible(category.id)}
              onChange={() => toggle(category.id)}
            />
          </li>
        ))}
      </ul>
      <p className="hint">
        Turn off an activity to hide it from the Activity screen. Only the activities tracked by
        this app are listed here.
      </p>
    </div>
  )
}
