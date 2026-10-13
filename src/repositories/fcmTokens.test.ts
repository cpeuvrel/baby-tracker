import { deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteFcmToken, saveFcmToken } from './fcmTokens'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, setDoc: vi.fn(), getDoc: vi.fn(), deleteDoc: vi.fn() }
})

const setDocMock = vi.mocked(setDoc)
const getDocMock = vi.mocked(getDoc)
const deleteDocMock = vi.mocked(deleteDoc)

function stubExisting(exists: boolean) {
  getDocMock.mockResolvedValue({ exists: () => exists } as unknown as Awaited<ReturnType<typeof getDoc>>)
}

describe('fcmTokens repository', () => {
  beforeEach(() => {
    setDocMock.mockReset()
    getDocMock.mockReset()
    deleteDocMock.mockReset()
  })

  it('saves a new token keyed by its own value, created and seen now', async () => {
    stubExisting(false)

    await saveFcmToken('uid1', 'token-abc')

    expect(getDocMock).toHaveBeenCalledTimes(1)
    expect((getDocMock.mock.calls[0][0] as { path: string }).path).toBe('users/uid1/fcmTokens/token-abc')
    expect(setDocMock).toHaveBeenCalledTimes(1)
    const [ref, payload, options] = setDocMock.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>, unknown]
    expect(ref.path).toBe('users/uid1/fcmTokens/token-abc')
    expect(payload).toMatchObject({ token: 'token-abc' })
    expect(payload.createdAt).toBeDefined()
    expect(payload.lastSeenAt).toBeDefined()
    expect(options).toEqual({ merge: true })
  })

  it('keeps the creation date of a known token and only marks it seen', async () => {
    stubExisting(true)

    await saveFcmToken('uid1', 'token-abc')

    const [ref, payload] = setDocMock.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('users/uid1/fcmTokens/token-abc')
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload.lastSeenAt).toBeDefined()
  })

  it('deletes a token', async () => {
    await deleteFcmToken('uid1', 'token-abc')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
    const [ref] = deleteDocMock.mock.calls[0] as unknown as [{ path: string }]
    expect(ref.path).toBe('users/uid1/fcmTokens/token-abc')
  })
})
