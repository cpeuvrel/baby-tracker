import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import type { SleepEntry } from '../types/models'
import { ActiveTimersBanner } from './ActiveTimersBanner'

const stopSleep = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  stopSleep: (...args: unknown[]) => stopSleep(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('ActiveTimersBanner', () => {
  beforeEach(() => {
    stopSleep.mockReset()
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('renders nothing when no sleep timer is active', () => {
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)

    const { container } = render(<ActiveTimersBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the active sleep timer and stops it on click', async () => {
    const sleepEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(sleepEntry)
    const user = userEvent.setup()

    render(<ActiveTimersBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Sleep in progress for')
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T20:00:00.000Z'))
  })
})
