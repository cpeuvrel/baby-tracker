import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  const loginWithGoogle = vi.fn()

  beforeEach(() => {
    loginWithGoogle.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      error: null,
      loginWithGoogle,
      logout: vi.fn(),
    })
  })

  it('renders a Google sign-in button', () => {
    render(<LoginPage />)

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('triggers loginWithGoogle on click', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))

    expect(loginWithGoogle).toHaveBeenCalled()
  })

  it('shows the auth error when present', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      error: 'Unable to sign in with Google.',
      loginWithGoogle,
      logout: vi.fn(),
    })

    render(<LoginPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to sign in with Google.')
  })
})
