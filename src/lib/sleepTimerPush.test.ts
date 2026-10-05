import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestNotificationToken = vi.fn()
const saveFcmToken = vi.fn()

vi.mock('./messaging', () => ({ requestNotificationToken: () => requestNotificationToken() }))
vi.mock('../repositories/fcmTokens', () => ({
  saveFcmToken: (...args: unknown[]) => saveFcmToken(...args),
}))

describe('registerSleepTimerPush', () => {
  beforeEach(() => {
    vi.resetModules()
    requestNotificationToken.mockReset()
    saveFcmToken.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves this device token once per session', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    requestNotificationToken.mockResolvedValue('token1')
    const { registerSleepTimerPush } = await import('./sleepTimerPush')

    await registerSleepTimerPush('uid1')
    await registerSleepTimerPush('uid1')

    expect(saveFcmToken).toHaveBeenCalledTimes(1)
    expect(saveFcmToken).toHaveBeenCalledWith('uid1', 'token1')
  })

  it('does nothing once notifications are denied', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    const { registerSleepTimerPush } = await import('./sleepTimerPush')

    await registerSleepTimerPush('uid1')

    expect(requestNotificationToken).not.toHaveBeenCalled()
    expect(saveFcmToken).not.toHaveBeenCalled()
  })
})
