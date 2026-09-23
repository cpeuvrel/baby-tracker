import { setDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveFcmToken } from './fcmTokens'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, setDoc: vi.fn() }
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
})
