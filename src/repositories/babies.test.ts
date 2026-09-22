import { onSnapshot } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { subscribeToBabies } from './babies'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, onSnapshot: vi.fn() }
})

const onSnapshotMock = vi.mocked(onSnapshot)

describe('babies repository', () => {
  beforeEach(() => {
    onSnapshotMock.mockReset()
  })

  it('maps the babies of a household', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([{ id: 'b1', data: { name: 'Léo', birthDate: '2025-06-01' } }]),
      )
      return vi.fn()
    })

    subscribeToBabies('h1', onChange)

    expect(onChange).toHaveBeenCalledWith([{ id: 'b1', name: 'Léo', birthDate: '2025-06-01' }])
  })
})
