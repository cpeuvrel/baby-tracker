import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestNotificationToken } from './messaging'

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(),
  getToken: vi.fn(),
  isSupported: vi.fn(),
}))
vi.mock('./firebase', () => ({ app: {} }))

const isSupportedMock = vi.mocked(isSupported)
const getMessagingMock = vi.mocked(getMessaging)
const getTokenMock = vi.mocked(getToken)

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
})
