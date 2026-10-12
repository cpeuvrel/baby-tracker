import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestNotificationToken = vi.fn()
const saveFcmToken = vi.fn()
const clearSleepTimerMute = vi.fn()

vi.mock('./messaging', () => ({ requestNotificationToken: () => requestNotificationToken() }))
vi.mock('../repositories/fcmTokens', () => ({
  saveFcmToken: (...args: unknown[]) => saveFcmToken(...args),
  clearSleepTimerMute: (...args: unknown[]) => clearSleepTimerMute(...args),
}))
vi.mock('./pushIdentity', () => ({ savePushIdentity: vi.fn().mockResolvedValue(undefined) }))

describe('registerPush', () => {
  beforeEach(() => {
    vi.resetModules()
    requestNotificationToken.mockReset()
    saveFcmToken.mockReset()
    clearSleepTimerMute.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves this device token once per session', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    requestNotificationToken.mockResolvedValue('token1')
    const { registerPush } = await import('./pushRegistration')

    await registerPush('uid1')
    await registerPush('uid1')

    expect(saveFcmToken).toHaveBeenCalledTimes(1)
    expect(saveFcmToken).toHaveBeenCalledWith('uid1', 'token1')
  })

  it('does nothing once notifications are denied', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    const { registerPush } = await import('./pushRegistration')

    await registerPush('uid1')

    expect(requestNotificationToken).not.toHaveBeenCalled()
    expect(saveFcmToken).not.toHaveBeenCalled()
  })

  it('clears a swiped-away sleep timer on this device when the app opens', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    requestNotificationToken.mockResolvedValue('token1')
    const { unmuteSleepTimer } = await import('./pushRegistration')

    await unmuteSleepTimer('uid1')

    expect(clearSleepTimerMute).toHaveBeenCalledWith('uid1', 'token1')
  })

  it('has nothing to clear without a registered device', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    const { unmuteSleepTimer } = await import('./pushRegistration')

    await unmuteSleepTimer('uid1')

    expect(clearSleepTimerMute).not.toHaveBeenCalled()
  })
})
