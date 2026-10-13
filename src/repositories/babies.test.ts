import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { babiesCollection } from '../lib/paths'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import {
  addBaby,
  deleteBaby,
  subscribeToBabies,
  updateBaby,
  updateBabyPhoto,
  updateNighttimeHours,
} from './babies'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), deleteDoc: vi.fn(), onSnapshot: vi.fn(), updateDoc: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const deleteDocMock = vi.mocked(deleteDoc)
const onSnapshotMock = vi.mocked(onSnapshot)
const updateDocMock = vi.mocked(updateDoc)

describe('babies repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    deleteDocMock.mockReset()
    onSnapshotMock.mockReset()
    updateDocMock.mockReset()
  })

  it('subscribes to the babies of the household, ordered by name', () => {
    onSnapshotMock.mockReturnValue(vi.fn())

    subscribeToBabies('h1', vi.fn())

    expectQuery(onSnapshotMock.mock.calls[0][0], query(babiesCollection('h1'), orderBy('name')))
  })

  it('forwards listener errors to onError', () => {
    const onError = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, _next: unknown, error: (e: Error) => void) => {
      error(new Error('permission-denied'))
      return vi.fn()
    }) as never)

    subscribeToBabies('h1', vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })

  it('maps the babies of a household', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([{ id: 'b1', data: { name: 'Léo', birthDate: '2025-06-01', sex: null } }]),
      )
      return vi.fn()
    })

    subscribeToBabies('h1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null, nighttimeHours: null, photoDataUrl: null },
    ])
  })

  it('maps a stored nighttimeHours setting', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'b1',
            data: {
              name: 'Léo',
              birthDate: '2025-06-01',
              sex: null,
              nighttimeHours: { start: '21:00', end: '06:30' },
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToBabies('h1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'b1',
        name: 'Léo',
        birthDate: '2025-06-01',
        sex: null,
        nighttimeHours: { start: '21:00', end: '06:30' },
        photoDataUrl: null,
      },
    ])
  })

  it('creates a new baby with the given name and birth date', async () => {
    await addBaby('h1', 'Nina', '2026-01-15')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [ref, payload] = addDocMock.mock.calls[0]
    expect((ref as CollectionReference).path).toBe('households/h1/babies')
    expect(payload).toEqual({ name: 'Nina', birthDate: '2026-01-15', sex: null })
  })

  it('creates a new baby with a given sex', async () => {
    await addBaby('h1', 'Nina', '2026-01-15', 'female')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toEqual({ name: 'Nina', birthDate: '2026-01-15', sex: 'female' })
  })

  it('updates an existing baby with the given name and birth date', async () => {
    await updateBaby('h1', 'b1', 'Léo Updated', '2025-06-02', 'male')

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [ref, payload] = updateDocMock.mock.calls[0]
    expect((ref as DocumentReference).path).toBe('households/h1/babies/b1')
    expect(payload).toEqual({ name: 'Léo Updated', birthDate: '2025-06-02', sex: 'male' })
  })

  it('updates the nighttime hours of a baby', async () => {
    await updateNighttimeHours('h1', 'b1', { start: '21:00', end: '06:30' })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [ref, payload] = updateDocMock.mock.calls[0]
    expect((ref as DocumentReference).path).toBe('households/h1/babies/b1')
    expect(payload).toEqual({ nighttimeHours: { start: '21:00', end: '06:30' } })
  })

  it('stores or clears the photo of a baby', async () => {
    await updateBabyPhoto('h1', 'b1', 'data:image/jpeg;base64,AAA')
    await updateBabyPhoto('h1', 'b1', null)

    expect(updateDocMock.mock.calls.map(([ref]) => (ref as DocumentReference).path)).toEqual([
      'households/h1/babies/b1',
      'households/h1/babies/b1',
    ])
    expect(updateDocMock.mock.calls.map(([, payload]) => payload)).toEqual([
      { photoDataUrl: 'data:image/jpeg;base64,AAA' },
      { photoDataUrl: null },
    ])
  })

  it('deletes a baby', async () => {
    await deleteBaby('h1', 'b1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
    const [ref] = deleteDocMock.mock.calls[0]
    expect((ref as DocumentReference).path).toBe('households/h1/babies/b1')
  })
})
