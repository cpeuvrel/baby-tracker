import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveBottleFeedingModule from '../hooks/useActiveBottleFeeding'
import type { FeedingEntry } from '../types/models'
import { FeedingCard } from './FeedingCard'

const startBottleFeeding = vi.fn()
const stopBottleFeeding = vi.fn()
const logSolidFeeding = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  startBottleFeeding: (...args: unknown[]) => startBottleFeeding(...args),
  stopBottleFeeding: (...args: unknown[]) => stopBottleFeeding(...args),
  logSolidFeeding: (...args: unknown[]) => logSolidFeeding(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('FeedingCard', () => {
  beforeEach(() => {
    startBottleFeeding.mockReset()
    stopBottleFeeding.mockReset()
    logSolidFeeding.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('starts a bottle feeding when idle', async () => {
    vi.spyOn(useActiveBottleFeedingModule, 'useActiveBottleFeeding').mockReturnValue(null)
    const user = userEvent.setup()

    render(<FeedingCard />)
    await user.click(screen.getByRole('button', { name: 'Démarrer le biberon' }))

    expect(startBottleFeeding).toHaveBeenCalledWith('h1', 'b1', 'uid1')
  })

  it('stops the active bottle feeding with the entered volume', async () => {
    const activeEntry: FeedingEntry = {
      id: 'entry1',
      type: 'bottle',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      volumeMl: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }
    vi.spyOn(useActiveBottleFeedingModule, 'useActiveBottleFeeding').mockReturnValue(activeEntry)
    const user = userEvent.setup()

    render(<FeedingCard />)
    await user.type(screen.getByLabelText('Volume (mL)'), '120')
    await user.click(screen.getByRole('button', { name: 'Arrêter le biberon' }))

    expect(stopBottleFeeding).toHaveBeenCalledWith(
      'h1',
      'b1',
      'entry1',
      new Date('2026-03-05T10:00:00.000Z'),
      120,
    )
  })

  it('logs a solid feeding with the entered notes', async () => {
    vi.spyOn(useActiveBottleFeedingModule, 'useActiveBottleFeeding').mockReturnValue(null)
    const user = userEvent.setup()

    render(<FeedingCard />)
    await user.type(screen.getByLabelText('Aliment (optionnel)'), 'purée carotte')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le repas' }))

    expect(logSolidFeeding).toHaveBeenCalledWith('h1', 'b1', 'uid1', 'purée carotte')
  })
})
