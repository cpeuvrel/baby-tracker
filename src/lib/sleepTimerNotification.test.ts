import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closeSleepTimerNotification,
  closeSleepTimerNotifications,
  isSleepTimerTag,
  showSleepTimerNotification,
  sleepTimerNotificationBody,
  sleepTimerTag,
  sleepTimerUrl,
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
  it('gives the baby and the elapsed time', () => {
    expect(
      sleepTimerNotificationBody('Léo', new Date('2026-03-05T20:00:00Z'), new Date('2026-03-05T21:05:00Z')),
    ).toBe('Léo — 1h 05m')
  })
})

describe('showSleepTimerNotification', () => {
  it('shows a silent, sticky notification that opens the timer', async () => {
    const { registration } = stubNotifications('granted')
    const startedAt = new Date('2026-03-05T20:00:00Z')

    await showSleepTimerNotification('b1', 'Léo', startedAt, new Date('2026-03-05T20:10:00Z'))

    expect(registration.showNotification).toHaveBeenCalledWith(
      'Sleep Timer',
      expect.objectContaining({
        body: 'Léo — 10m',
        tag: 'sleep-timer-b1',
        silent: true,
        requireInteraction: true,
        timestamp: startedAt.getTime(),
        data: { url: '/?timer=sleep&baby=b1' },
      }),
    )
  })

  it('does nothing without permission', async () => {
    const { registration } = stubNotifications('denied')

    await showSleepTimerNotification('b1', 'Léo', new Date(), new Date())

    expect(registration.showNotification).not.toHaveBeenCalled()
  })
})

describe('closeSleepTimerNotification', () => {
  it("closes the baby's timer notification", async () => {
    const { registration, close } = stubNotifications('granted')

    await closeSleepTimerNotification('b1')

    expect(registration.getNotifications).toHaveBeenCalledWith({ tag: 'sleep-timer-b1' })
    expect(close).toHaveBeenCalled()
  })
})

describe('closeSleepTimerNotifications', () => {
  it('closes every timer notification when no baby is given, and nothing else', async () => {
    const timerA = { tag: 'sleep-timer-a', close: vi.fn() }
    const legacyTimer = { tag: 'sleep-timer', close: vi.fn() }
    const vaccine = { tag: 'vaccine-day-v1', close: vi.fn() }
    const registration = { getNotifications: vi.fn().mockResolvedValue([timerA, legacyTimer, vaccine]) }

    await closeSleepTimerNotifications(registration as unknown as ServiceWorkerRegistration)

    expect(registration.getNotifications).toHaveBeenCalledWith(undefined)
    expect(timerA.close).toHaveBeenCalled()
    expect(legacyTimer.close).toHaveBeenCalled()
    expect(vaccine.close).not.toHaveBeenCalled()
  })
})

describe('sleep timer tags and links', () => {
  it('gives each baby its own notification and link', () => {
    expect(sleepTimerTag('b1')).toBe('sleep-timer-b1')
    expect(sleepTimerTag('b1')).not.toBe(sleepTimerTag('b2'))
    expect(sleepTimerUrl('b 1')).toBe('/?timer=sleep&baby=b%201')
  })

  it('recognizes the timer notifications', () => {
    expect(isSleepTimerTag('sleep-timer-b1')).toBe(true)
    expect(isSleepTimerTag('sleep-timer')).toBe(true)
    expect(isSleepTimerTag('vaccine-day-v1')).toBe(false)
    expect(isSleepTimerTag('')).toBe(false)
  })
})
