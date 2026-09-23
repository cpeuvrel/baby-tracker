import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import type { SleepEntry } from '../types/models'
import { SleepTimerModal } from './SleepTimerModal'

const startSleep = vi.fn()
const stopSleep = vi.fn()
const logSleep = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  startSleep: (...args: unknown[]) => startSleep(...args),
  stopSleep: (...args: unknown[]) => stopSleep(...args),
  logSleep: (...args: unknown[]) => logSleep(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('SleepTimerModal', () => {
  beforeEach(() => {
    startSleep.mockReset()
    stopSleep.mockReset()
    logSleep.mockReset()
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

  it('shows an editable Start/End form with a Start Timer button and Save in the header when nothing is active', () => {
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)

    render(<SleepTimerModal onClose={vi.fn()} />)

    expect(screen.getByLabelText('Start Time')).toBeInTheDocument()
    expect(screen.getByLabelText('End Time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Timer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('starts the timer and shows a starting placeholder until the active entry resolves', async () => {
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    expect(startSleep).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Starting…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Timer' })).toBeDisabled()
  })

  it('shows the live counter and a Stop Timer button once an entry is active', async () => {
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
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes without saving anything when Save is pressed while a timer is active', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logSleep).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('saves a fixed past entry directly once an end time is entered, via the header Save', async () => {
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '2026-03-05T20:00' } })
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '2026-03-05T21:30' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1', {
      startedAt: new Date('2026-03-05T20:00'),
      endedAt: new Date('2026-03-05T21:30'),
      notes: '',
    })
    expect(startSleep).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
