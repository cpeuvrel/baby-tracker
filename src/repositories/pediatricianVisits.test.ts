import { addDoc, deleteDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import {
  addPediatricianVisit,
  deletePediatricianVisit,
  subscribeToPediatricianVisits,
  updatePediatricianVisit,
} from './pediatricianVisits'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return {
    ...actual,
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    onSnapshot: vi.fn(),
  }
})

const addDocMock = vi.mocked(addDoc)
const updateDocMock = vi.mocked(updateDoc)
const deleteDocMock = vi.mocked(deleteDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('pediatricianVisits repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    deleteDocMock.mockReset()
    onSnapshotMock.mockReset()
  })

  it('creates an empty visit and returns its id', async () => {
    addDocMock.mockResolvedValue({ id: 'v1' } as Awaited<ReturnType<typeof addDoc>>)

    const id = await addPediatricianVisit('h1', 'b1', 'uid1', { date: '2026-10-08', vaccinated: true })

    expect(id).toBe('v1')
    const [ref, payload] = addDocMock.mock.calls[0]
    expect((ref as { path: string }).path).toBe('households/h1/babies/b1/pediatricianVisits')
    expect(payload).toMatchObject({
      date: '2026-10-08',
      vaccinated: true,
      vaccineBought: false,
      remarks: [],
      discussions: [],
      createdBy: 'uid1',
    })
  })

  it('updates only the given fields', async () => {
    await updatePediatricianVisit('h1', 'b1', 'v1', { remarks: [{ id: 'r1', text: 'Fine' }] })

    const [ref, payload] = updateDocMock.mock.calls[0]
    expect((ref as { path: string }).path).toBe('households/h1/babies/b1/pediatricianVisits/v1')
    expect(payload).toEqual({ remarks: [{ id: 'r1', text: 'Fine' }] })
  })

  it('deletes a visit', async () => {
    await deletePediatricianVisit('h1', 'b1', 'v1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('maps visits from a snapshot, defaulting missing lists', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'v1',
            data: {
              date: '2026-10-08',
              vaccinated: false,
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-10-08T10:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToPediatricianVisits('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'v1',
        date: '2026-10-08',
        vaccinated: false,
        vaccineBought: false,
        remarks: [],
        discussions: [],
        createdBy: 'uid1',
        createdAt: '2026-10-08T10:00:00.000Z',
      },
    ])
  })
})
