import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveBottleFeedingModule from '../hooks/useActiveBottleFeeding'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import type { FeedingEntry, SleepEntry } from '../types/models'
import { ActiveTimersBanner } from './ActiveTimersBanner'

const stopSleep = vi.fn()
const stopBottleFeeding = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  stopSleep: (...args: unknown[]) => stopSleep(...args),
}))
vi.mock('../repositories/feedingEntries', () => ({
  stopBottleFeeding: (...args: unknown[]) => stopBottleFeeding(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('ActiveTimersBanner', () => {
  beforeEach(() => {
    stopSleep.mockReset()
    stopBottleFeeding.mockReset()
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('renders nothing when no timer is active', () => {
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)
    vi.spyOn(useActiveBottleFeedingModule, 'useActiveBottleFeeding').mockReturnValue(null)

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
    vi.spyOn(useActiveBottleFeedingModule, 'useActiveBottleFeeding').mockReturnValue(null)
    const user = userEvent.setup()

    render(<ActiveTimersBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Sommeil en cours depuis')
    await user.click(screen.getByRole('button', { name: 'Arrêter' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T20:00:00.000Z'))
  })

  it('shows both timers when sleep and feeding are active simultaneously', () => {
    const sleepEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const feedingEntry: FeedingEntry = {
      id: 'feed1',
      type: 'bottle',
      startedAt: '2026-03-05T20:05:00.000Z',
      endedAt: null,
      durationSeconds: null,
      volumeMl: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:05:00.000Z',
    }
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(sleepEntry)
    vi.spyOn(useActiveBottleFeedingModule, 'useActiveBottleFeeding').mockReturnValue(feedingEntry)

    render(<ActiveTimersBanner />)

    expect(screen.getAllByRole('button', { name: 'Arrêter' })).toHaveLength(2)
  })
})
