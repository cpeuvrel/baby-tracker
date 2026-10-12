import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AccountSettingsPage } from './AccountSettingsPage'
import { mockAuth } from '../test/mockContexts'

describe('AccountSettingsPage', () => {
  it('shows the connected account email and no Communication section', () => {
    mockAuth({ user: { uid: 'uid1', email: 'parent1@example.com' } as User })

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('parent1@example.com')).toBeInTheDocument()
    expect(screen.queryByText(/Communication/)).not.toBeInTheDocument()
  })

  it('logs out when the Log out button is clicked', async () => {
    const logout = vi.fn()
    mockAuth({ user: { uid: 'uid1', email: 'parent1@example.com' } as User, logout })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(logout).toHaveBeenCalled()
  })

  it('says so when signing out failed', () => {
    mockAuth({
      user: { uid: 'uid1', email: 'parent1@example.com' } as User,
      error: 'Unable to sign out. (auth/network-request-failed)',
    })

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to sign out.')
  })
})
