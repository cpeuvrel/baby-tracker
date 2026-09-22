import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  const logout = vi.fn()

  beforeEach(() => {
    logout.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { email: 'parent@example.com' } as User,
      loading: false,
      login: vi.fn(),
      logout,
    })
  })

  it('shows the signed-in user email', () => {
    render(<HomePage />)

    expect(screen.getByText('Connecté en tant que parent@example.com')).toBeInTheDocument()
  })

  it('calls logout when the button is clicked', async () => {
    const user = userEvent.setup()
    render(<HomePage />)

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(logout).toHaveBeenCalled()
  })
})
