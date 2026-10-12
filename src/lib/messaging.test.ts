import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  const originalNotification = globalThis.Notification
  const originalServiceWorker = navigator.serviceWorker

  beforeEach(() => {
    isSupportedMock.mockReset()
    getMessagingMock.mockReset()
    getTokenMock.mockReset()
    vi.stubEnv('VITE_FCM_VAPID_KEY', 'test-vapid-key')
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.Notification = originalNotification
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
    })
  })

  it('returns null when the platform does not support messaging', async () => {
    isSupportedMock.mockResolvedValue(false)

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns null when permission is denied', async () => {
    isSupportedMock.mockResolvedValue(true)
    globalThis.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    } as unknown as typeof Notification

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns null when no VAPID key is configured', async () => {
    isSupportedMock.mockResolvedValue(true)
    globalThis.Notification = { permission: 'granted' } as unknown as typeof Notification
    vi.stubEnv('VITE_FCM_VAPID_KEY', '')

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns the token when permission is already granted', async () => {
    isSupportedMock.mockResolvedValue(true)
    globalThis.Notification = { permission: 'granted' } as unknown as typeof Notification
    getMessagingMock.mockReturnValue({} as ReturnType<typeof getMessaging>)
    getTokenMock.mockResolvedValue('the-token')

    expect(await requestNotificationToken()).toBe('the-token')
  })

  it('returns null when getToken throws', async () => {
    isSupportedMock.mockResolvedValue(true)
    globalThis.Notification = { permission: 'granted' } as unknown as typeof Notification
    getMessagingMock.mockReturnValue({} as ReturnType<typeof getMessaging>)
    getTokenMock.mockRejectedValue(new Error('no push service'))

    expect(await requestNotificationToken()).toBeNull()
  })

  it('returns null when asking for the permission throws (older Safari)', async () => {
    isSupportedMock.mockResolvedValue(true)
    const requestPermission = vi.fn().mockRejectedValue(new TypeError('callback form only'))
    globalThis.Notification = { permission: 'default', requestPermission } as unknown as typeof Notification

    expect(await requestNotificationToken()).toBeNull()
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('does not ask again once notifications are denied', async () => {
    isSupportedMock.mockResolvedValue(true)
    const requestPermission = vi.fn()
    globalThis.Notification = { permission: 'denied', requestPermission } as unknown as typeof Notification

    expect(await requestNotificationToken()).toBeNull()
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('returns null when the service worker is unavailable', async () => {
    isSupportedMock.mockResolvedValue(true)
    globalThis.Notification = { permission: 'granted' } as unknown as typeof Notification
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.reject(new Error('no service worker')) },
      configurable: true,
    })

    expect(await requestNotificationToken()).toBeNull()
  })

  it('reads the current token without ever asking', async () => {
    isSupportedMock.mockResolvedValue(true)
    const requestPermission = vi.fn()
    globalThis.Notification = { permission: 'default', requestPermission } as unknown as typeof Notification
    expect(await currentNotificationToken()).toBeNull()
    expect(requestPermission).not.toHaveBeenCalled()

    globalThis.Notification = { permission: 'granted' } as unknown as typeof Notification
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
