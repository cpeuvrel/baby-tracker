import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentNotificationToken, deleteNotificationToken, requestNotificationToken } from './messaging'

vi.mock('firebase/messaging', () => ({
  deleteToken: vi.fn(),
  getMessaging: vi.fn(),
  getToken: vi.fn(),
  isSupported: vi.fn(),
}))
vi.mock('./firebase', () => ({ app: {} }))

const isSupportedMock = vi.mocked(isSupported)
const getMessagingMock = vi.mocked(getMessaging)
const getTokenMock = vi.mocked(getToken)
const deleteTokenMock = vi.mocked(deleteToken)

describe('requestNotificationToken', () => {
  beforeEach(() => {
    isSupportedMock.mockReset()
    getMessagingMock.mockReset()
    getTokenMock.mockReset()
    vi.stubEnv('VITE_FCM_VAPID_KEY', 'test-vapid-key')
    // Globals and env vars stubbed here are restored automatically (unstubGlobals / unstubEnvs).
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({}) } })
  })

  it('returns null when the platform does not support messaging', async () => {
    isSupportedMock.mockResolvedValue(false)

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns null when permission is denied', async () => {
    isSupportedMock.mockResolvedValue(true)
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    })

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns null when no VAPID key is configured', async () => {
    isSupportedMock.mockResolvedValue(true)
    vi.stubGlobal('Notification', { permission: 'granted' })
    vi.stubEnv('VITE_FCM_VAPID_KEY', '')

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns the token when permission is already granted', async () => {
    isSupportedMock.mockResolvedValue(true)
    vi.stubGlobal('Notification', { permission: 'granted' })
    getMessagingMock.mockReturnValue({} as ReturnType<typeof getMessaging>)
    getTokenMock.mockResolvedValue('the-token')

    expect(await requestNotificationToken()).toBe('the-token')
  })

  it('returns null when getToken throws', async () => {
    isSupportedMock.mockResolvedValue(true)
    vi.stubGlobal('Notification', { permission: 'granted' })
    getMessagingMock.mockReturnValue({} as ReturnType<typeof getMessaging>)
    getTokenMock.mockRejectedValue(new Error('no push service'))

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns null when asking for the permission throws (older Safari)', async () => {
    isSupportedMock.mockResolvedValue(true)
    const requestPermission = vi.fn().mockRejectedValue(new TypeError('callback form only'))
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })

    expect(await requestNotificationToken()).toBeNull()
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('does not ask again once notifications are denied', async () => {
    isSupportedMock.mockResolvedValue(true)
    const requestPermission = vi.fn()
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission })

    expect(await requestNotificationToken()).toBeNull()
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('returns null when the service worker is unavailable', async () => {
    isSupportedMock.mockResolvedValue(true)
    vi.stubGlobal('Notification', { permission: 'granted' })
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.reject(new Error('no service worker')) } })

    expect(await requestNotificationToken()).toBeNull()
  })

  it('reads the current token without ever asking', async () => {
    isSupportedMock.mockResolvedValue(true)
    const requestPermission = vi.fn()
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })
    expect(await currentNotificationToken()).toBeNull()
    expect(requestPermission).not.toHaveBeenCalled()

    vi.stubGlobal('Notification', { permission: 'granted' })
    getMessagingMock.mockReturnValue({} as ReturnType<typeof getMessaging>)
    getTokenMock.mockResolvedValue('the-token')
    expect(await currentNotificationToken()).toBe('the-token')
  })

  it('invalidates the token, ignoring failures', async () => {
    deleteTokenMock.mockRejectedValueOnce(new Error('offline'))

    await expect(deleteNotificationToken()).resolves.toBeUndefined()
    expect(deleteTokenMock).toHaveBeenCalledTimes(1)
  })
})
