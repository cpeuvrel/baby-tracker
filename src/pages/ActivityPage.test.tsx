import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { zonedTime } from '../lib/appTime'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import * as useGrowthEntriesModule from '../hooks/useGrowthEntries'
import * as useRecentBathEntriesModule from '../hooks/useRecentBathEntries'
import * as useRecentDiaperEntriesModule from '../hooks/useRecentDiaperEntries'
import * as useRecentFeedingEntriesModule from '../hooks/useRecentFeedingEntries'
import * as useRecentMedicationEntriesModule from '../hooks/useRecentMedicationEntries'
import * as useRecentSleepEntriesModule from '../hooks/useRecentSleepEntries'
import * as useReminderModule from '../hooks/useReminder'
import type { BathEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { ActivityPage } from './ActivityPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ActivityPage />} />
        <Route path="/history" element={<p>History screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

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
  options: {
    recentSleep?: SleepEntry[]
    recentFeeding?: FeedingEntry[]
    recentMedication?: MedicationEntry[]
    recentBath?: BathEntry[]
  } = {},
) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: { uid: 'uid1' } as User,
    loading: false,
    error: null,
    devLoginAvailable: false,
    loginWithGoogle: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [baby],
    loading: false,
    error: null,
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
  vi.spyOn(useRecentMedicationEntriesModule, 'useRecentMedicationEntries').mockReturnValue(
    options.recentMedication ?? [],
  )
  vi.spyOn(useRecentBathEntriesModule, 'useRecentBathEntries').mockReturnValue(options.recentBath ?? [])
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
    localStorage.clear()
  })

  it('renders a category card for each category', () => {
    setupHooks()

    renderPage()

    expect(screen.getByRole('region', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Diaper' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Routine' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Growth' })).toBeInTheDocument()
  })

  it('opens the sleep modal without starting anything when idle', async () => {
    setupHooks(null)
    const user = userEvent.setup()

    renderPage()
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

    renderPage()
    await user.click(screen.getByRole('button', { name: 'View the running timer' }))

    expect(startSleep).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Timer' })).not.toBeInTheDocument()
  })

  it('opens the feeding modal and closes it once saved', async () => {
    setupHooks()
    logFeeding.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Add a feeding entry' }))
    expect(screen.getByRole('dialog', { name: 'Feed' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logFeeding).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds a bath, a vitamin or another medication from the Routine card', async () => {
    setupHooks()
    const user = userEvent.setup()

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Add a routine entry' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Add to Routine' })).getByRole('button', { name: 'Bath' }))
    expect(screen.getByRole('dialog', { name: 'Bath' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Add a routine entry' }))
    await user.click(screen.getByRole('button', { name: 'Other medication' }))
    expect(screen.getByRole('textbox', { name: 'Medication' })).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    const routineCard = within(screen.getByRole('region', { name: 'Routine' }))
    await user.click(routineCard.getByRole('button', { name: /Vitamin D/ }))
    expect(screen.getByRole('dialog', { name: 'Medication' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Medication' })).toHaveValue('Vitamin D')
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

    renderPage()
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

    renderPage()
    await user.click(screen.getByText('Woke up'))

    expect(screen.getByRole('dialog', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByLabelText('Hours')).toHaveValue(1)
    expect(screen.getByLabelText('Minutes')).toHaveValue(0)
    expect(startSleep).not.toHaveBeenCalled()
  })

  describe('recent entries since last night', () => {
    // 18:03 in Paris: the cards list entries since yesterday 20:00.
    const now = zonedTime(2026, 3, 5, 18, 3)

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(now)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const makeSleepEntry = (id: string, startedAt: Date, endedAt: Date): SleepEntry => ({
      id,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds: Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
      notes: '',
      createdBy: 'uid1',
      createdAt: startedAt.toISOString(),
    })

    const makeFeeding = (id: string, occurredAt: Date, volumeMl: number): FeedingEntry => ({
      id,
      type: 'bottle',
      occurredAt: occurredAt.toISOString(),
      volumeMl,
      foodType: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: occurredAt.toISOString(),
    })

    it("lists last night's sleep behind Show More, but not older ones", async () => {
      setupHooks(null, {
        recentSleep: [
          makeSleepEntry('nap', zonedTime(2026, 3, 5, 15, 1), zonedTime(2026, 3, 5, 16, 1)),
          makeSleepEntry('night', zonedTime(2026, 3, 4, 19, 37), zonedTime(2026, 3, 5, 7, 25)),
          makeSleepEntry('yesterday-nap', zonedTime(2026, 3, 4, 13, 0), zonedTime(2026, 3, 4, 15, 15)),
        ],
      })
      const user = userEvent.setup()

      renderPage()
      const sleepCard = within(screen.getByRole('region', { name: 'Sleep' }))
      await user.click(sleepCard.getByRole('button', { name: 'Show More' }))

      expect(sleepCard.getByText('YD 19:37 – 07:25')).toBeInTheDocument()
      expect(sleepCard.getByText('11h 48m')).toBeInTheDocument()
      expect(sleepCard.queryByText('2h 15m')).not.toBeInTheDocument()
    })

    it('sends older feeds to History from the "Entries before 20:00" link', async () => {
      setupHooks(null, {
        recentFeeding: [
          makeFeeding('latest', zonedTime(2026, 3, 5, 16, 1), 180),
          makeFeeding('last-night', zonedTime(2026, 3, 4, 22, 0), 100),
          makeFeeding('yesterday', zonedTime(2026, 3, 4, 16, 0), 77),
        ],
      })
      const user = userEvent.setup()

      renderPage()
      const feedCard = within(screen.getByRole('region', { name: 'Feed' }))
      expect(feedCard.getByText('180')).toBeInTheDocument()
      await user.click(feedCard.getByRole('button', { name: 'Show More' }))

      expect(feedCard.getByText('YD 22:00 Bottle')).toBeInTheDocument()
      expect(feedCard.queryByText('77 mL')).not.toBeInTheDocument()

      await user.click(feedCard.getByRole('button', { name: 'Entries before 20:00' }))

      expect(screen.getByText('History screen')).toBeInTheDocument()
    })
  })

  it("shows when the last bath and vitamin were, and today's routine behind Show More", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(zonedTime(2026, 3, 5, 18, 3))
    const bath: BathEntry = {
      id: 'bath1',
      occurredAt: zonedTime(2026, 3, 4, 19, 0).toISOString(),
      notes: '',
      createdBy: 'uid1',
      createdAt: zonedTime(2026, 3, 4, 19, 0).toISOString(),
    }
    const vitamin: MedicationEntry = {
      id: 'm1',
      name: 'Vitamin/Probiotic',
      givenAt: zonedTime(2026, 3, 5, 16, 3).toISOString(),
      dose: '',
      notes: '',
      createdBy: 'uid1',
      createdAt: zonedTime(2026, 3, 5, 16, 3).toISOString(),
    }
    setupHooks(null, { recentBath: [bath], recentMedication: [vitamin] })
    const user = userEvent.setup()

    try {
      renderPage()
      const routineCard = within(screen.getByRole('region', { name: 'Routine' }))
      expect(routineCard.getByText('23h 3m ago')).toBeInTheDocument()
      expect(routineCard.getByText('2h 0m ago')).toBeInTheDocument()

      await user.click(routineCard.getByRole('button', { name: 'Show More' }))
      expect(routineCard.getByText('16:03 Vitamin/Probiotic')).toBeInTheDocument()
      // Yesterday 19:00 is before last night's 20:00 start.
      expect(routineCard.queryByText('YD 19:00 Bath')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('orders the cards like the reference app: Feed, Diaper, Sleep, Routine, Growth', () => {
    setupHooks()

    renderPage()

    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
      'Feed',
      'Diaper',
      'Sleep',
      'Routine',
      'Growth',
    ])
  })

  it('opens Edit Activities for the selected baby from the bottom of the screen', async () => {
    setupHooks()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ActivityPage />} />
          <Route path="account/family/:babyId/activities" element={<p>Edit activities screen</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Edit Activities' }))

    expect(screen.getByText('Edit activities screen')).toBeInTheDocument()
  })

  it('hides a category card turned off in Edit Activities', () => {
    localStorage.setItem('baby-tracker:hiddenActivities', JSON.stringify(['growth']))
    setupHooks()

    renderPage()

    expect(screen.getByRole('region', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Growth' })).not.toBeInTheDocument()
  })

  it('navigates to the growth detail page when a growth row is clicked', async () => {
    setupHooks()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ActivityPage />} />
          <Route path="growth/:metric" element={<p>Growth detail</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Weight' }))

    expect(screen.getByText('Growth detail')).toBeInTheDocument()
  })
})
