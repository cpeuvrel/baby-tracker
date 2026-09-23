import { Link } from 'react-router-dom'

export function AccountPage() {
  return (
    <div>
      <h1>Account</h1>
      <ul className="list-group">
        <li>
          <Link to="/account/family">
            <span>Family</span>
            <span className="list-row-chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link to="/account/settings">
            <span>Settings</span>
            <span className="list-row-chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      </ul>
    </div>
  )
}
