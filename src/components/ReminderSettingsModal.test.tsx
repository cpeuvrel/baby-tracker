import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useReminderModule from '../hooks/useReminder'
import type { Reminder } from '../types/models'
import { ReminderSettingsModal } from './ReminderSettingsModal'
import { setTime, timeValue } from '../test/timeFields'

const setReminder = vi.fn()
const requestNotificationToken = vi.fn()
const saveFcmToken = vi.fn()

vi.mock('../repositories/reminders', () => ({
  setReminder: (...args: unknown[]) => setReminder(...args),
}))
vi.mock('../lib/messaging', () => ({
  requestNotificationToken: (...args: unknown[]) => requestNotificationToken(...args),
}))
vi.mock('../repositories/fcmTokens', () => ({
  saveFcmToken: (...args: unknown[]) => saveFcmToken(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('ReminderSettingsModal', () => {
  beforeEach(() => {
    setReminder.mockReset()
    requestNotificationToken.mockReset()
    saveFcmToken.mockReset()
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
  })

  it('defaults to an inactive reminder at 09:00 when none exists yet', () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'Reminder active' })).not.toBeChecked()
    expect(timeValue('Reminder time')).toBe('09:00')
  })

  it('reflects an existing reminder', () => {
    const reminder: Reminder = {
      id: 'Vitamine D',
      medicationName: 'Vitamine D',
      timeOfDay: '08:30',
      active: true,
    }
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(reminder)

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'Reminder active' })).toBeChecked()
    expect(timeValue('Reminder time')).toBe('08:30')
  })

  it('saves the reminder when the active toggle changes', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    const user = userEvent.setup()

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Reminder active' }))

    expect(setReminder).toHaveBeenCalledWith('h1', 'b1', 'Vitamine D', '09:00', true)
  })

  it('saves the reminder when the time changes', () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    setTime('Reminder time', '08:30')

    expect(setReminder).toHaveBeenLastCalledWith('h1', 'b1', 'Vitamine D', '08:30', false)
  })

  it('enables notifications and saves the token on success', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    requestNotificationToken.mockResolvedValue('the-token')
    const user = userEvent.setup()

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enable notifications' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications enabled' })).toBeDisabled(),
    )
    expect(saveFcmToken).toHaveBeenCalledWith('uid1', 'the-token')
  })

  it('shows an error when notifications cannot be enabled', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    requestNotificationToken.mockResolvedValue(null)
    const user = userEvent.setup()

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enable notifications' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications denied')
    expect(saveFcmToken).not.toHaveBeenCalled()
  })
})
