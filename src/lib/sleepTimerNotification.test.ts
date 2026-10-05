import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closeSleepTimerNotification,
  showSleepTimerNotification,
  SLEEP_TIMER_NOTIFICATION_TAG,
  SLEEP_TIMER_URL,
  sleepTimerNotificationBody,
} from './sleepTimerNotification'

function stubNotifications(permission: NotificationPermission) {
  const close = vi.fn()
  const registration = {
    showNotification: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn().mockResolvedValue([{ close }]),
  }
  vi.stubGlobal('Notification', { permission })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  })
  return { registration, close }
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('sleepTimerNotificationBody', () => {
  it('gives the baby, the elapsed time and the start (Paris time)', () => {
    expect(
      sleepTimerNotificationBody('Léo', new Date('2026-03-05T20:00:00Z'), new Date('2026-03-05T21:05:00Z')),
    ).toBe('Léo — asleep for 1h 05m (since 21:00)')
  })
})

describe('showSleepTimerNotification', () => {
  it('shows a silent, sticky notification that opens the timer', async () => {
    const { registration } = stubNotifications('granted')
    const startedAt = new Date('2026-03-05T20:00:00Z')

    await showSleepTimerNotification('Léo', startedAt, new Date('2026-03-05T20:10:00Z'))

    expect(registration.showNotification).toHaveBeenCalledWith(
      'Sleep Timer',
      expect.objectContaining({
        tag: SLEEP_TIMER_NOTIFICATION_TAG,
        silent: true,
        requireInteraction: true,
        timestamp: startedAt.getTime(),
        data: { url: SLEEP_TIMER_URL },
      }),
    )
  })

  it('does nothing without permission', async () => {
    const { registration } = stubNotifications('denied')

    await showSleepTimerNotification('Léo', new Date(), new Date())

    expect(registration.showNotification).not.toHaveBeenCalled()
  })
})

describe('closeSleepTimerNotification', () => {
  it('closes the timer notification', async () => {
    const { registration, close } = stubNotifications('granted')

    await closeSleepTimerNotification()

    expect(registration.getNotifications).toHaveBeenCalledWith({ tag: SLEEP_TIMER_NOTIFICATION_TAG })
    expect(close).toHaveBeenCalled()
  })
})
