import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useReminderModule from '../hooks/useReminder'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { Reminder } from '../types/models'
import { ReminderSettingsModal, TIME_SAVE_DELAY_MS } from './ReminderSettingsModal'
import { setTime, timeValue } from '../test/timeFields'

const setReminder = vi.fn()
const registerPush = vi.fn()

vi.mock('../repositories/reminders', () => ({
  setReminder: (...args: unknown[]) => setReminder(...args),
}))
vi.mock('../lib/pushRegistration', () => ({
  registerPush: (...args: unknown[]) => registerPush(...args),
}))

describe('ReminderSettingsModal', () => {
  beforeEach(() => {
    setReminder.mockReset()
    registerPush.mockReset()
    mockAuth()
    mockHousehold()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
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

  it('saves the time once the user settles on it, not at every digit', () => {
    vi.useFakeTimers()
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    setTime('Reminder time', '08:30')

    expect(setReminder).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(TIME_SAVE_DELAY_MS))
    expect(setReminder).toHaveBeenCalledTimes(1)
    expect(setReminder).toHaveBeenCalledWith('h1', 'b1', 'Vitamine D', '08:30', false)
  })

  it('saves a time still waiting when the modal closes', () => {
    vi.useFakeTimers()
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)

    const { unmount } = render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    setTime('Reminder time', '08:30')
    unmount()

    expect(setReminder).toHaveBeenCalledTimes(1)
    expect(setReminder).toHaveBeenCalledWith('h1', 'b1', 'Vitamine D', '08:30', false)
  })

  it('enables notifications on success', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    vi.stubGlobal('Notification', { permission: 'default' })
    registerPush.mockResolvedValue(true)
    const user = userEvent.setup()

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enable notifications' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notifications enabled' })).toBeDisabled(),
    )
    expect(registerPush).toHaveBeenCalledWith('uid1')
  })

  it('shows an error when notifications cannot be enabled, and lets the user retry', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    vi.stubGlobal('Notification', { permission: 'default' })
    registerPush.mockResolvedValue(false)
    const user = userEvent.setup()

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enable notifications' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not enable notifications')
    expect(screen.getByRole('button', { name: 'Enable notifications' })).toBeEnabled()
  })

  it('recovers when saving the token fails', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    vi.stubGlobal('Notification', { permission: 'default' })
    registerPush.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enable notifications' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not enable notifications')
    expect(screen.getByRole('button', { name: 'Enable notifications' })).toBeEnabled()
  })

  it('shows notifications already allowed as enabled, and keeps the token on file', async () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    vi.stubGlobal('Notification', { permission: 'granted' })
    registerPush.mockResolvedValue(true)

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Notifications enabled' })).toBeDisabled()
    await waitFor(() => expect(registerPush).toHaveBeenCalledWith('uid1'))
  })

  it('explains notifications blocked in the browser', () => {
    vi.spyOn(useReminderModule, 'useReminder').mockReturnValue(null)
    vi.stubGlobal('Notification', { permission: 'denied' })

    render(<ReminderSettingsModal medicationName="Vitamine D" onClose={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('blocked')
    expect(screen.getByRole('button', { name: 'Enable notifications' })).toBeDisabled()
    expect(registerPush).not.toHaveBeenCalled()
  })
})
