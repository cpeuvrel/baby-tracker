import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import * as useGrowthEntriesModule from '../hooks/useGrowthEntries'
import * as useRecentDiaperEntriesModule from '../hooks/useRecentDiaperEntries'
import * as useRecentFeedingEntriesModule from '../hooks/useRecentFeedingEntries'
import * as useRecentMedicationEntriesModule from '../hooks/useRecentMedicationEntries'
import * as useRecentSleepEntriesModule from '../hooks/useRecentSleepEntries'
import * as useReminderModule from '../hooks/useReminder'
import type { FeedingEntry, SleepEntry } from '../types/models'
import { ActivityPage } from './ActivityPage'

const startSleep = vi.fn()
const updateSleepEntry = vi.fn()
const deleteSleepEntry = vi.fn()
const logFeeding = vi.fn()
const updateFeedingEntry = vi.fn()
const deleteFeedingEntry = vi.fn()
const logDiaper = vi.fn()
const logMedication = vi.fn()
const setReminder = vi.fn()
const addGrowthEntry = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  startSleep: (...args: unknown[]) => startSleep(...args),
  stopSleep: vi.fn(),
  logSleep: vi.fn(),
  updateSleepEntry: (...args: unknown[]) => updateSleepEntry(...args),
  deleteSleepEntry: (...args: unknown[]) => deleteSleepEntry(...args),
}))
vi.mock('../repositories/feedingEntries', () => ({
  logFeeding: (...args: unknown[]) => logFeeding(...args),
  updateFeedingEntry: (...args: unknown[]) => updateFeedingEntry(...args),
  deleteFeedingEntry: (...args: unknown[]) => deleteFeedingEntry(...args),
}))
vi.mock('../repositories/diaperEntries', () => ({
  logDiaper: (...args: unknown[]) => logDiaper(...args),
}))
vi.mock('../repositories/medicationEntries', () => ({
  logMedication: (...args: unknown[]) => logMedication(...args),
}))
vi.mock('../repositories/reminders', () => ({
  setReminder: (...args: unknown[]) => setReminder(...args),
}))
vi.mock('../repositories/growthEntries', () => ({
  addGrowthEntry: (...args: unknown[]) => addGrowthEntry(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

function setupHooks(
  activeSleepEntry: SleepEntry | null = null,
  options: { recentSleep?: SleepEntry[]; recentFeeding?: FeedingEntry[] } = {},
) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: { uid: 'uid1' } as User,
    loading: false,
    error: null,
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [baby],
    loading: false,
    selectedBaby: baby,
    selectBaby: vi.fn(),
  })
  vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(activeSleepEntry)
  vi.spyOn(useRecentSleepEntriesModule, 'useRecentSleepEntries').mockReturnValue(
    options.recentSleep ?? [],
  )
  vi.spyOn(useRecentFeedingEntriesModule, 'useRecentFeedingEntries').mockReturnValue(
    options.recentFeeding ?? [],
  )
  vi.spyOn(useRecentDiaperEntriesModule, 'useRecentDiaperEntries').mockReturnValue([])
  vi.spyOn(useRecentMedicationEntriesModule, 'useRecentMedicationEntries').mockReturnValue([])
  vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
  vi.spyOn(useGrowthEntriesModule, 'useGrowthEntries').mockReturnValue([])
}

describe('ActivityPage', () => {
  beforeEach(() => {
    startSleep.mockReset()
    logFeeding.mockReset()
    logDiaper.mockReset()
    logMedication.mockReset()
    setReminder.mockReset()
    addGrowthEntry.mockReset()
  })

  it('renders a category card for each of the four categories', () => {
    setupHooks()

    render(<ActivityPage />)

    expect(screen.getByRole('region', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Diaper' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Medication' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Growth' })).toBeInTheDocument()
  })

  it('opens the sleep modal without starting anything when idle', async () => {
    setupHooks(null)
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Add a sleep entry' }))

    expect(startSleep).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Timer' })).toBeInTheDocument()
  })

  it('opens the sleep modal directly in live mode when one is already active', async () => {
    const activeEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    setupHooks(activeEntry)
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'View the running timer' }))

    expect(startSleep).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Timer' })).not.toBeInTheDocument()
  })

  it('opens the feeding modal and closes it once saved', async () => {
    setupHooks()
    logFeeding.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Add a feeding entry' }))
    expect(screen.getByRole('dialog', { name: 'Feed' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logFeeding).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the medication modal and the reminder settings modal', async () => {
    setupHooks()
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Add a dose' }))
    expect(screen.getByRole('dialog', { name: 'Medication' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Set reminder' }))
    expect(screen.getByRole('dialog', { name: 'Vitamin D Reminder' })).toBeInTheDocument()
  })

  it('opens the feeding entry for edit when the primary entry is clicked, and deletes it', async () => {
    const feedingEntry: FeedingEntry = {
      id: 'f1',
      type: 'bottle',
      occurredAt: '2026-03-05T09:00:00.000Z',
      volumeMl: 120,
      foodType: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T09:00:00.000Z',
    }
    setupHooks(null, { recentFeeding: [feedingEntry] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByText('Last feeding'))
    expect(screen.getByRole('dialog', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByLabelText('Volume (mL, optional)')).toHaveValue(120)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteFeedingEntry).toHaveBeenCalledWith('h1', 'b1', 'f1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the completed sleep entry for edit, not the active timer, when clicked from the list', async () => {
    const completedEntry: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-04T20:00:00.000Z',
      endedAt: '2026-03-04T21:00:00.000Z',
      durationSeconds: 3600,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-04T20:00:00.000Z',
    }
    setupHooks(null, { recentSleep: [completedEntry] })
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByText('Woke up'))

    expect(screen.getByRole('dialog', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByLabelText('Duration (minutes)')).toHaveValue(60)
    expect(startSleep).not.toHaveBeenCalled()
  })

  it('shows earlier entries from today directly, and hides entries from before today behind Show more', async () => {
    const now = new Date()
    const earlierToday = new Date(now)
    earlierToday.setHours(0, 30, 0, 0)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const makeEntry = (id: string, occurredAt: Date, volumeMl: number): FeedingEntry => ({
      id,
      type: 'bottle',
      occurredAt: occurredAt.toISOString(),
      volumeMl,
      foodType: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: occurredAt.toISOString(),
    })

    setupHooks(null, {
      recentFeeding: [
        makeEntry('latest', now, 40),
        makeEntry('earlier-today', earlierToday, 100),
        makeEntry('yesterday', yesterday, 77),
      ],
    })
    const user = userEvent.setup()

    render(<ActivityPage />)

    expect(screen.getByText('100 mL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument()
    expect(screen.queryByText('77 mL')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show more' }))

    expect(screen.getByText('77 mL')).toBeInTheDocument()
  })
})
