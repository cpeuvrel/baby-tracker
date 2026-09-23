import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AccountSettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate('/account')}>
          ‹
        </button>
        <h2>Settings</h2>
      </div>

      <ul className="list-group">
        <li>
          <span>{user?.email}</span>
          <span className="list-group-meta">Signed in</span>
        </li>
      </ul>

      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </div>
  )
}
