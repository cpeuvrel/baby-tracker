import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import type { SleepEntry } from '../types/models'
import { SleepTimerModal } from './SleepTimerModal'

const stopSleep = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  stopSleep: (...args: unknown[]) => stopSleep(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('SleepTimerModal', () => {
  beforeEach(() => {
    stopSleep.mockReset()
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

  it('shows a starting state while no active entry has resolved yet', () => {
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)

    render(<SleepTimerModal onClose={vi.fn()} />)

    expect(screen.getByText('Démarrage…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop Timer' })).toBeDisabled()
  })

  it('shows the live counter and stops the entry on click', async () => {
    const activeEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(activeEntry)
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Stop Timer' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T20:00:00.000Z'))
    expect(onClose).toHaveBeenCalled()
  })
})
