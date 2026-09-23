import { addDoc, onSnapshot } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { createHousehold, subscribeToHouseholdForUser } from './households'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('households repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    onSnapshotMock.mockReset()
  })

  it('creates a household for the given member', async () => {
    addDocMock.mockResolvedValue({ id: 'h1' } as never)

    const householdId = await createHousehold('uid1')

    expect(householdId).toBe('h1')
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toEqual({ name: 'My Family', memberUids: ['uid1'] })
  })

  it('reports the household the user belongs to', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([{ id: 'h1', data: { name: 'Famille Test', memberUids: ['uid1', 'uid2'] } }]),
      )
      return vi.fn()
    })

    subscribeToHouseholdForUser('uid1', onChange)

    expect(onChange).toHaveBeenCalledWith({
      id: 'h1',
      name: 'Famille Test',
      memberUids: ['uid1', 'uid2'],
    })
  })

  it('reports null when the user has no household', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(fakeSnapshot([]))
      return vi.fn()
    })

    subscribeToHouseholdForUser('uid1', onChange)

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
