import { onSnapshot } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { subscribeToHouseholdForUser } from './households'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, onSnapshot: vi.fn() }
})

const onSnapshotMock = vi.mocked(onSnapshot)

describe('households repository', () => {
  beforeEach(() => {
    onSnapshotMock.mockReset()
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
