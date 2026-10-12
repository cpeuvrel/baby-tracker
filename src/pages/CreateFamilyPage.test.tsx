import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { CreateFamilyPage } from './CreateFamilyPage'

const createHouseholdWithBaby = vi.fn()

vi.mock('../repositories/households', () => ({
  createHouseholdWithBaby: (...args: unknown[]) => createHouseholdWithBaby(...args),
}))

describe('CreateFamilyPage', () => {
  beforeEach(() => {
    createHouseholdWithBaby.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1', email: 'amandineandcorentin@gmail.com' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders nothing without a signed-in user', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })

    const { container } = render(<CreateFamilyPage />)

    expect(container).toBeEmptyDOMElement()
  })

  async function fillAndSubmit() {
    const user = userEvent.setup()
    render(<CreateFamilyPage />)
    await user.type(screen.getByLabelText('First Name'), ' Nina ')
    await user.click(screen.getByRole('button', { name: 'Girl' }))
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    return user
  }

  it('creates the household with the first child and the entered details', async () => {
    createHouseholdWithBaby.mockResolvedValue('h1')

    await fillAndSubmit()

    expect(createHouseholdWithBaby).toHaveBeenCalledWith('uid1', {
      name: 'Nina',
      birthDate: '2026-01-15',
      sex: 'female',
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an alert and enables the button again when the creation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    createHouseholdWithBaby.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce('h1')

    const user = await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create your family')
    expect(consoleError).toHaveBeenCalledWith('[family] creation failed', expect.any(Error))
    const button = screen.getByRole('button', { name: 'Add child' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(createHouseholdWithBaby).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('does not submit without a sex selected', async () => {
    const user = userEvent.setup()

    render(<CreateFamilyPage />)
    await user.type(screen.getByLabelText('First Name'), 'Nina')
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    expect(createHouseholdWithBaby).not.toHaveBeenCalled()
  })
})
