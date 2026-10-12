import { deleteField, setDoc, updateDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSleepTimerMute, saveFcmToken } from './fcmTokens'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, setDoc: vi.fn(), updateDoc: vi.fn() }
})

const setDocMock = vi.mocked(setDoc)

describe('fcmTokens repository', () => {
  beforeEach(() => {
    setDocMock.mockReset()
  })

  it('saves the token keyed by its own value', async () => {
    await saveFcmToken('uid1', 'token-abc')

    expect(setDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = setDocMock.mock.calls[0]
    expect(payload).toMatchObject({ token: 'token-abc' })
  })

  it('clears the sleep timer mute of this device', async () => {
    await clearSleepTimerMute('uid1', 'token-abc')

    const [ref, payload] = vi.mocked(updateDoc).mock.calls[0]
    expect((ref as { path: string }).path).toBe('users/uid1/fcmTokens/token-abc')
    expect(payload).toEqual({ mutedSleepEntryId: deleteField() })
  })
})
