import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import type { SleepEntry } from '../types/models'
import { SleepTimerCard } from './SleepTimerCard'

const startSleep = vi.fn()
const stopSleep = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  startSleep: (...args: unknown[]) => startSleep(...args),
  stopSleep: (...args: unknown[]) => stopSleep(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

function mockHousehold() {
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [baby],
    loading: false,
    selectedBaby: baby,
    selectBaby: vi.fn(),
  })
}

describe('SleepTimerCard', () => {
  beforeEach(() => {
    startSleep.mockReset()
    stopSleep.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders nothing without a resolved household and baby', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)

    const { container } = render(<SleepTimerCard />)

    expect(container).toBeEmptyDOMElement()
  })

  it('starts a sleep entry when idle', async () => {
    mockHousehold()
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)
    const user = userEvent.setup()

    render(<SleepTimerCard />)
    await user.click(screen.getByRole('button', { name: 'Démarrer le sommeil' }))

    expect(startSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1')
  })

  it('stops the active sleep entry', async () => {
    mockHousehold()
    const activeEntry: SleepEntry = {
      id: 'entry1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(activeEntry)
    const user = userEvent.setup()

    render(<SleepTimerCard />)
    await user.click(screen.getByRole('button', { name: 'Arrêter le sommeil' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'entry1', new Date('2026-03-05T10:00:00.000Z'))
  })
})
