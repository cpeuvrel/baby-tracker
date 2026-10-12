import { isSupported, onMessage, type MessagePayload } from 'firebase/messaging'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showVaccinePushesInForeground } from './foregroundPush'

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(),
  isSupported: vi.fn(),
  onMessage: vi.fn(),
}))
vi.mock('./firebase', () => ({ app: {} }))

describe('showVaccinePushesInForeground', () => {
  const registration = {
    showNotification: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn().mockResolvedValue([]),
  }
  let deliver: (payload: MessagePayload) => void

  beforeEach(() => {
    registration.showNotification.mockClear()
    vi.mocked(isSupported).mockResolvedValue(true)
    vi.mocked(onMessage).mockImplementation((_messaging, next) => {
      deliver = next as (payload: MessagePayload) => void
      return () => {}
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('shows the medication reminder received while the app is open', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    await showVaccinePushesInForeground()

    deliver({ data: { type: 'medication-reminder', medicationName: 'Vitamin D' } } as unknown as MessagePayload)

    await vi.waitFor(() =>
      expect(registration.showNotification).toHaveBeenCalledWith('Reminder: Vitamin D', expect.anything()),
    )
  })

  it('shows nothing without the permission', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    await showVaccinePushesInForeground()

    deliver({ data: { type: 'medication-reminder', medicationName: 'Vitamin D' } } as unknown as MessagePayload)
    await Promise.resolve()

    expect(registration.showNotification).not.toHaveBeenCalled()
  })
})
