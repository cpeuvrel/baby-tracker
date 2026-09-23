import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  const loginWithGoogle = vi.fn()
  const loginWithPassword = vi.fn()

  const mockAuth = (overrides: Partial<ReturnType<typeof AuthContext.useAuth>> = {}) => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle,
      loginWithPassword,
      logout: vi.fn(),
      ...overrides,
    })
  }

  beforeEach(() => {
    loginWithGoogle.mockReset()
    loginWithPassword.mockReset().mockResolvedValue(undefined)
    mockAuth()
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
    mockAuth({ error: 'Unable to sign in with Google.' })

    render(<LoginPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to sign in with Google.')
  })

  it('hides the local sign-in form outside the emulator', () => {
    render(<LoginPage />)

    expect(screen.queryByRole('button', { name: 'Sign in locally' })).not.toBeInTheDocument()
  })

  it('signs in with the prefilled emulator credentials', async () => {
    mockAuth({ devLoginAvailable: true })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Sign in locally' }))

    expect(loginWithPassword).toHaveBeenCalledWith('amandineandcorentin@gmail.com', 'password123')
  })
})
