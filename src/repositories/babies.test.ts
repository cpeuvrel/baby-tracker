import { addDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { addBaby, subscribeToBabies, updateBaby, updateBabyPhoto, updateNighttimeHours } from './babies'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn(), updateDoc: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)
const updateDocMock = vi.mocked(updateDoc)

describe('babies repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    onSnapshotMock.mockReset()
    updateDocMock.mockReset()
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
    const [, payload] = addDocMock.mock.calls[0]
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
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toEqual({ name: 'Léo Updated', birthDate: '2025-06-02', sex: 'male' })
  })

  it('updates the nighttime hours of a baby', async () => {
    await updateNighttimeHours('h1', 'b1', { start: '21:00', end: '06:30' })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toEqual({ nighttimeHours: { start: '21:00', end: '06:30' } })
  })

  it('stores or clears the photo of a baby', async () => {
    await updateBabyPhoto('h1', 'b1', 'data:image/jpeg;base64,AAA')
    await updateBabyPhoto('h1', 'b1', null)

    expect(updateDocMock.mock.calls.map(([, payload]) => payload)).toEqual([
      { photoDataUrl: 'data:image/jpeg;base64,AAA' },
      { photoDataUrl: null },
    ])
  })
})
