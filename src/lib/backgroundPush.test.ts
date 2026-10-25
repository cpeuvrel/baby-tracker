import { describe, expect, it, vi } from 'vitest'
import { handleBackgroundPush, MEDICATION_REMINDER_PUSH, medicationNotification, readPushData } from './backgroundPush'

function fakeRegistration(shown: Array<{ tag: string }> = []) {
  const notifications = shown.map((notification) => ({ ...notification, close: vi.fn() }))
  const registration = {
    showNotification: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn(async (filter?: { tag?: string }) =>
      notifications.filter((notification) => !filter?.tag || notification.tag === filter.tag),
    ),
  }
  return { registration, notifications, asRegistration: registration as unknown as ServiceWorkerRegistration }
}

const now = new Date('2026-03-05T21:05:00Z')

describe('handleBackgroundPush', () => {
  it("draws a baby's sleep timer with the elapsed time computed on arrival", async () => {
    const { registration, asRegistration } = fakeRegistration()

    await handleBackgroundPush(
      asRegistration,
      { type: 'sleep-timer', babyId: 'b1', babyName: 'Léo', startedAt: '2026-03-05T20:00:00.000Z' },
      now,
    )

    expect(registration.showNotification).toHaveBeenCalledTimes(1)
    expect(registration.showNotification).toHaveBeenCalledWith(
      'Sleep Timer',
      expect.objectContaining({ body: 'Léo — 1h 05m', tag: 'sleep-timer-b1', data: { url: '/?timer=sleep&baby=b1' } }),
    )
  })

  it("closes only the stopped baby's timer", async () => {
    const { notifications, asRegistration } = fakeRegistration([{ tag: 'sleep-timer-b1' }, { tag: 'sleep-timer-b2' }])

    await handleBackgroundPush(asRegistration, { type: 'sleep-timer-stop', babyId: 'b1' }, now)

    expect(notifications[0].close).toHaveBeenCalled()
    expect(notifications[1].close).not.toHaveBeenCalled()
  })

  it('closes every timer for a stop without a baby (older server)', async () => {
    const { notifications, asRegistration } = fakeRegistration([
      { tag: 'sleep-timer-b1' },
      { tag: 'sleep-timer' },
      { tag: 'vaccine-day-v1' },
    ])

    await handleBackgroundPush(asRegistration, { type: 'sleep-timer-stop' }, now)

    expect(notifications.map((notification) => notification.close.mock.calls.length)).toEqual([1, 1, 0])
  })

  it('shows the medication reminder once', async () => {
    const { registration, asRegistration } = fakeRegistration()

    await handleBackgroundPush(asRegistration, { type: MEDICATION_REMINDER_PUSH, medicationName: 'Vitamin D' }, now)

    expect(registration.showNotification).toHaveBeenCalledTimes(1)
    expect(registration.showNotification).toHaveBeenCalledWith(
      'Reminder: Vitamin D',
      expect.objectContaining({ body: "Vitamin D hasn't been given yet today.", tag: 'medication-reminder-Vitamin D' }),
    )
  })

  it('shows the vaccine reminders and closes a settled purchase question', async () => {
    const { registration, notifications, asRegistration } = fakeRegistration([{ tag: 'vaccine-purchase-v1' }])
    const visit = { babyId: 'b1', babyName: 'Léo', visitId: 'v1', visitDate: '2026-10-11' }

    await handleBackgroundPush(asRegistration, { type: 'vaccine-day', ...visit }, now)
    await handleBackgroundPush(asRegistration, { type: 'vaccine-purchase-close', visitId: 'v1' }, now)

    expect(registration.showNotification).toHaveBeenCalledWith(
      'Vaccine today',
      expect.objectContaining({ tag: 'vaccine-day-v1' }),
    )
    expect(notifications[0].close).toHaveBeenCalled()
  })

  it('ignores unknown or incomplete pushes', async () => {
    const { registration, asRegistration } = fakeRegistration()

    await handleBackgroundPush(asRegistration, {}, now)
    await handleBackgroundPush(asRegistration, { type: 'something-else' }, now)
    await handleBackgroundPush(asRegistration, { type: 'sleep-timer', babyName: 'Léo' }, now)
    await handleBackgroundPush(asRegistration, { type: MEDICATION_REMINDER_PUSH }, now)

    expect(registration.showNotification).not.toHaveBeenCalled()
  })
})

describe('medicationNotification', () => {
  it('opens the app on tap', () => {
    expect(medicationNotification('Vitamin D').options.data).toEqual({ url: '/' })
  })
})

describe('readPushData', () => {
  it("keeps the string values of an FCM push's data", () => {
    expect(readPushData({ data: { type: 'sleep-timer', babyId: 'b1', n: 3 }, from: '123' })).toEqual({
      type: 'sleep-timer',
      babyId: 'b1',
    })
  })

  it('ignores pushes without data', () => {
    expect(readPushData(null)).toBeNull()
    expect(readPushData('text')).toBeNull()
    expect(readPushData({ notification: { title: 'x' } })).toBeNull()
  })
})
