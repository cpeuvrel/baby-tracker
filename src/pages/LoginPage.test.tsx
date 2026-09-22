import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirebaseError } from 'firebase/app'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  const login = vi.fn()

  beforeEach(() => {
    login.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login,
      logout: vi.fn(),
    })
  })

  it('has accessible labels for email and password', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
  })

  it('submits the entered credentials', async () => {
    login.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'parent@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('parent@example.com', 'hunter2'))
  })

  it('shows an error message when login fails with a Firebase error', async () => {
    login.mockRejectedValue(new FirebaseError('auth/wrong-password', 'Wrong password'))
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'parent@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.'),
    )
  })

  it('shows a generic error message for unexpected failures', async () => {
    login.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'parent@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Connexion impossible.'),
    )
  })
})
