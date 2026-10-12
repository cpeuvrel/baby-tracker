import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pediatricianVisitsCollection } from '../lib/paths'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { VisitRemark } from '../types/models'
import {
  addPediatricianVisit,
  deletePediatricianVisit,
  mutateVisitItems,
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
    runTransaction: vi.fn(),
  }
})

const addDocMock = vi.mocked(addDoc)
const updateDocMock = vi.mocked(updateDoc)
const deleteDocMock = vi.mocked(deleteDoc)
const onSnapshotMock = vi.mocked(onSnapshot)
const runTransactionMock = vi.mocked(runTransaction)

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

describe('pediatricianVisits queries and robustness', () => {
  beforeEach(() => {
    onSnapshotMock.mockReset().mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes to the visits, most recent appointment first', () => {
    subscribeToPediatricianVisits('h1', 'b1', vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(pediatricianVisitsCollection('h1', 'b1'), orderBy('date', 'desc')),
    )
  })

  it('skips a malformed visit and falls back to the visit date for a missing createdAt', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'broken', data: {} }, { id: 'v1', data: { date: '2026-10-08', createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToPediatricianVisits('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'v1', vaccinated: false, createdAt: '2026-10-08T00:00:00.000Z' }),
    ])
  })

  it('forwards listener errors to onError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, _next: unknown, error: (e: Error) => void) => {
      error(new Error('permission-denied'))
      return vi.fn()
    }) as never)

    subscribeToPediatricianVisits('h1', 'b1', vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})

describe('mutateVisitItems', () => {
  const fromOtherPhone: VisitRemark = { id: 'r-other', text: 'Added on the other phone' }
  const mine: VisitRemark = { id: 'r-mine', text: 'Mine' }

  function runWith(stored: Record<string, unknown> | null) {
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => stored !== null, data: () => stored }),
      update: vi.fn(),
    }
    runTransactionMock.mockReset().mockImplementation(((_db: unknown, apply: (t: unknown) => Promise<unknown>) =>
      apply(transaction)) as never)
    return transaction
  }

  it('applies the change to the stored list, keeping an item this phone never saw', async () => {
    const transaction = runWith({ remarks: [fromOtherPhone] })

    await mutateVisitItems('h1', 'b1', 'v1', 'remarks', (items) => [...items, mine])

    const [ref] = transaction.get.mock.calls[0] as [{ path: string }]
    expect(ref.path).toBe('households/h1/babies/b1/pediatricianVisits/v1')
    expect(transaction.update).toHaveBeenCalledWith(ref, { remarks: [fromOtherPhone, mine] })
  })

  it('starts from an empty list when the field is missing', async () => {
    const transaction = runWith({ date: '2026-10-08' })

    await mutateVisitItems('h1', 'b1', 'v1', 'discussions', (items) => [
      ...items,
      { id: 'd1', question: 'Q', answer: '' },
    ])

    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), {
      discussions: [{ id: 'd1', question: 'Q', answer: '' }],
    })
  })

  it('fails when the visit was deleted meanwhile', async () => {
    const transaction = runWith(null)

    await expect(mutateVisitItems('h1', 'b1', 'v1', 'remarks', (items) => items)).rejects.toThrow(
      'This visit no longer exists.',
    )
    expect(transaction.update).not.toHaveBeenCalled()
  })
})
