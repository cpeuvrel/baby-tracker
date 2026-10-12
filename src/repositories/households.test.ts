import {
  addDoc,
  deleteDoc,
  documentId,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { householdsCollection } from '../lib/paths'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { createHousehold, createHouseholdWithBaby, subscribeToHouseholdForUser } from './households'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return {
    ...actual,
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getDocsFromServer: vi.fn(),
    onSnapshot: vi.fn(),
  }
})

const addDocMock = vi.mocked(addDoc)
const deleteDocMock = vi.mocked(deleteDoc)
const getDocsFromServerMock = vi.mocked(getDocsFromServer)
const onSnapshotMock = vi.mocked(onSnapshot)

const membership = () =>
  query(householdsCollection(), where('memberUids', 'array-contains', 'uid1'), orderBy(documentId()), limit(1))

function snapshotWith(docs: Parameters<typeof fakeSnapshot>[0], fromCache = false) {
  onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
    next(fakeSnapshot(docs, { fromCache }))
    return vi.fn()
  }) as never)
}

describe('households repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    deleteDocMock.mockReset()
    getDocsFromServerMock.mockReset().mockResolvedValue(fakeSnapshot([]))
    onSnapshotMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a household for the given member once the server confirms there is none', async () => {
    addDocMock.mockResolvedValue({ id: 'h1' } as never)

    const householdId = await createHousehold('uid1')

    expect(householdId).toBe('h1')
    expectQuery(getDocsFromServerMock.mock.calls[0][0], membership())
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toEqual({ name: 'My Family', memberUids: ['uid1'] })
  })

  it('returns the household the server already knows instead of creating a second one', async () => {
    getDocsFromServerMock.mockResolvedValue(fakeSnapshot([{ id: 'existing', data: { memberUids: ['uid1'] } }]))

    expect(await createHousehold('uid1')).toBe('existing')
    expect(await createHouseholdWithBaby('uid1', { name: 'Nina', birthDate: '2026-01-15', sex: 'female' })).toBe(
      'existing',
    )
    expect(addDocMock).not.toHaveBeenCalled()
  })

  it('does not create a household while the server cannot be reached', async () => {
    getDocsFromServerMock.mockRejectedValue(new Error('unavailable'))

    await expect(
      createHouseholdWithBaby('uid1', { name: 'Nina', birthDate: '2026-01-15', sex: 'female' }),
    ).rejects.toThrow('unavailable')
    expect(addDocMock).not.toHaveBeenCalled()
  })

  it('creates the household with its first child', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'h1', path: 'households/h1' } as never).mockResolvedValueOnce({} as never)

    const householdId = await createHouseholdWithBaby('uid1', { name: 'Nina', birthDate: '2026-01-15', sex: 'female' })

    expect(householdId).toBe('h1')
    expect(addDocMock.mock.calls[0][1]).toEqual({ name: 'My Family', memberUids: ['uid1'] })
    const [babiesRef, baby] = addDocMock.mock.calls[1]
    expect((babiesRef as { path: string }).path).toBe('households/h1/babies')
    expect(baby).toEqual({ name: 'Nina', birthDate: '2026-01-15', sex: 'female' })
    expect(deleteDocMock).not.toHaveBeenCalled()
  })

  it('removes the new household when its first child cannot be created', async () => {
    const householdRef = { id: 'h1', path: 'households/h1' }
    addDocMock.mockResolvedValueOnce(householdRef as never).mockRejectedValueOnce(new Error('permission-denied'))

    await expect(
      createHouseholdWithBaby('uid1', { name: 'Nina', birthDate: '2026-01-15', sex: 'female' }),
    ).rejects.toThrow('permission-denied')
    expect(deleteDocMock).toHaveBeenCalledWith(householdRef)
  })

  it('subscribes to the first household of the user, by id', () => {
    onSnapshotMock.mockReturnValue(vi.fn())

    subscribeToHouseholdForUser('uid1', vi.fn())

    expectQuery(onSnapshotMock.mock.calls[0][0], membership())
  })

  it('reports the household the user belongs to', () => {
    const onChange = vi.fn()
    snapshotWith([{ id: 'h1', data: { name: 'Famille Test', memberUids: ['uid1', 'uid2'] } }])

    subscribeToHouseholdForUser('uid1', onChange)

    expect(onChange).toHaveBeenCalledWith({
      id: 'h1',
      name: 'Famille Test',
      memberUids: ['uid1', 'uid2'],
    })
  })

  it('reports a household found in the cache', () => {
    const onChange = vi.fn()
    snapshotWith([{ id: 'h1', data: { name: 'Famille Test', memberUids: ['uid1'] } }], true)

    subscribeToHouseholdForUser('uid1', onChange)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }))
  })

  it('reports null when the server says the user has no household', () => {
    const onChange = vi.fn()
    snapshotWith([])

    subscribeToHouseholdForUser('uid1', onChange)

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('ignores an empty snapshot served from the cache (offline start)', () => {
    const onChange = vi.fn()
    snapshotWith([], true)

    subscribeToHouseholdForUser('uid1', onChange)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('forwards listener errors to onError', () => {
    const onError = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, _next: unknown, error: (e: Error) => void) => {
      error(new Error('permission-denied'))
      return vi.fn()
    }) as never)

    subscribeToHouseholdForUser('uid1', vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})
