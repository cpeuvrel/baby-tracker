import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { CreateFamilyPage } from './CreateFamilyPage'

const addBaby = vi.fn()
const createHousehold = vi.fn()

vi.mock('../repositories/babies', () => ({
  addBaby: (...args: unknown[]) => addBaby(...args),
}))
vi.mock('../repositories/households', () => ({
  createHousehold: (...args: unknown[]) => createHousehold(...args),
}))

describe('CreateFamilyPage', () => {
  beforeEach(() => {
    addBaby.mockReset()
    createHousehold.mockReset()
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

  it('creates a household then the first child with the entered details', async () => {
    createHousehold.mockResolvedValue('h1')
    addBaby.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<CreateFamilyPage />)
    await user.type(screen.getByLabelText('First Name'), 'Nina')
    await user.click(screen.getByRole('button', { name: 'Girl' }))
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    expect(createHousehold).toHaveBeenCalledWith('uid1')
    expect(addBaby).toHaveBeenCalledWith('h1', 'Nina', '2026-01-15', 'female')
  })

  it('does not submit without a sex selected', async () => {
    const user = userEvent.setup()

    render(<CreateFamilyPage />)
    await user.type(screen.getByLabelText('First Name'), 'Nina')
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    expect(createHousehold).not.toHaveBeenCalled()
    expect(addBaby).not.toHaveBeenCalled()
  })
})
