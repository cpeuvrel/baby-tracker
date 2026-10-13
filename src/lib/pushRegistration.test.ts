import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestNotificationToken = vi.fn()
const currentNotificationToken = vi.fn()
const deleteNotificationToken = vi.fn()
const saveFcmToken = vi.fn()
const deleteFcmToken = vi.fn()

vi.mock('./messaging', () => ({
  requestNotificationToken: () => requestNotificationToken(),
  currentNotificationToken: () => currentNotificationToken(),
  deleteNotificationToken: () => deleteNotificationToken(),
}))
vi.mock('../repositories/fcmTokens', () => ({
  saveFcmToken: (...args: unknown[]) => saveFcmToken(...args),
  deleteFcmToken: (...args: unknown[]) => deleteFcmToken(...args),
}))

beforeEach(() => {
  vi.resetModules()
  requestNotificationToken.mockReset()
  currentNotificationToken.mockReset().mockResolvedValue(null)
  deleteNotificationToken.mockReset().mockResolvedValue(undefined)
  saveFcmToken.mockReset().mockResolvedValue(undefined)
  deleteFcmToken.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registerPush', () => {
  it('saves this device token once per session', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    requestNotificationToken.mockResolvedValue('token1')
    const { registerPush } = await import('./pushRegistration')

    expect(await registerPush('uid1')).toBe(true)
    expect(await registerPush('uid1')).toBe(true)

    expect(saveFcmToken).toHaveBeenCalledTimes(1)
    expect(saveFcmToken).toHaveBeenCalledWith('uid1', 'token1')
  })

  it('does nothing once notifications are denied', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    const { registerPush } = await import('./pushRegistration')

    expect(await registerPush('uid1')).toBe(false)

    expect(requestNotificationToken).not.toHaveBeenCalled()
    expect(saveFcmToken).not.toHaveBeenCalled()
  })

  it('asks for the permission once when it was never answered', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    requestNotificationToken.mockResolvedValue(null)
    const { registerPush } = await import('./pushRegistration')

    expect(await registerPush('uid1')).toBe(false)

    expect(requestNotificationToken).toHaveBeenCalledTimes(1)
    expect(saveFcmToken).not.toHaveBeenCalled()
  })

  it('can try again after the token failed to save', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    requestNotificationToken.mockResolvedValue('token1')
    saveFcmToken.mockRejectedValueOnce(new Error('offline'))
    const { registerPush } = await import('./pushRegistration')

    await expect(registerPush('uid1')).rejects.toThrow('offline')
    expect(await registerPush('uid1')).toBe(true)

    expect(saveFcmToken).toHaveBeenCalledTimes(2)
  })
})

describe('unregisterPush', () => {
  it('forgets the token registered this session and invalidates it', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    requestNotificationToken.mockResolvedValue('token1')
    currentNotificationToken.mockResolvedValue('token1')
    const { registerPush, unregisterPush } = await import('./pushRegistration')
    await registerPush('uid1')

    await unregisterPush('uid1')

    expect(deleteFcmToken).toHaveBeenCalledWith('uid1', 'token1')
    expect(deleteNotificationToken).toHaveBeenCalledTimes(1)
    // Registered again on the next sign-in.
    await registerPush('uid1')
    expect(saveFcmToken).toHaveBeenCalledTimes(2)
  })

  it("forgets this device's token saved in an earlier session", async () => {
    currentNotificationToken.mockResolvedValue('token-from-before')
    const { unregisterPush } = await import('./pushRegistration')

    await unregisterPush('uid1')

    expect(deleteFcmToken).toHaveBeenCalledWith('uid1', 'token-from-before')
    expect(deleteNotificationToken).toHaveBeenCalledTimes(1)
  })

  it('does nothing on a device without notifications', async () => {
    const { unregisterPush } = await import('./pushRegistration')

    await unregisterPush('uid1')

    expect(deleteFcmToken).not.toHaveBeenCalled()
    expect(deleteNotificationToken).not.toHaveBeenCalled()
  })

  it('never blocks sign-out: a failed or stuck delete is given up', async () => {
    vi.useFakeTimers()
    try {
      currentNotificationToken.mockResolvedValue('token1')
      deleteFcmToken.mockReturnValue(new Promise(() => {}))
      const { unregisterPush } = await import('./pushRegistration')

      const done = unregisterPush('uid1')
      await vi.advanceTimersByTimeAsync(5000)
      await done

      expect(deleteNotificationToken).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
