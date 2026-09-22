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
import type { SleepEntry } from '../types/models'
import { ActivityPage } from './ActivityPage'

const startSleep = vi.fn()
const logFeeding = vi.fn()
const logDiaper = vi.fn()
const logMedication = vi.fn()
const setReminder = vi.fn()
const addGrowthEntry = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  startSleep: (...args: unknown[]) => startSleep(...args),
  stopSleep: vi.fn(),
}))
vi.mock('../repositories/feedingEntries', () => ({
  logFeeding: (...args: unknown[]) => logFeeding(...args),
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
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

function setupHooks(activeSleepEntry: SleepEntry | null = null) {
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
  vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(activeSleepEntry)
  vi.spyOn(useRecentSleepEntriesModule, 'useRecentSleepEntries').mockReturnValue([])
  vi.spyOn(useRecentFeedingEntriesModule, 'useRecentFeedingEntries').mockReturnValue([])
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

    expect(screen.getByRole('region', { name: 'Sommeil' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Nourriture' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Couches' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Médicament' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Croissance' })).toBeInTheDocument()
  })

  it('starts a sleep entry and opens the timer modal when idle', async () => {
    setupHooks(null)
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Ajouter une entrée sommeil' }))

    expect(startSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1')
    expect(screen.getByRole('dialog', { name: 'Sommeil' })).toBeInTheDocument()
  })

  it('does not start a new sleep entry when one is already active', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Ajouter une entrée sommeil' }))

    expect(startSleep).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Sommeil' })).toBeInTheDocument()
  })

  it('opens the feeding modal and closes it once saved', async () => {
    setupHooks()
    logFeeding.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Ajouter une entrée nourriture' }))
    expect(screen.getByRole('dialog', { name: 'Nourriture' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(logFeeding).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the medication modal and the reminder settings modal', async () => {
    setupHooks()
    const user = userEvent.setup()

    render(<ActivityPage />)
    await user.click(screen.getByRole('button', { name: 'Ajouter une prise' }))
    expect(screen.getByRole('dialog', { name: 'Médicament' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    await user.click(screen.getByRole('button', { name: 'Régler le rappel' }))
    expect(screen.getByRole('dialog', { name: 'Rappel Vitamine D' })).toBeInTheDocument()
  })
})
