import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { AccountSettingsPage } from './AccountSettingsPage'

describe('AccountSettingsPage', () => {
  it('shows the connected account email and no Communication section', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1', email: 'parent1@example.com' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })

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
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1', email: 'parent1@example.com' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout,
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(logout).toHaveBeenCalled()
  })
})
