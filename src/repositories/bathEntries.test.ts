import {
  addDoc,
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { bathEntriesCollection } from '../lib/paths'
import { dayRange } from '../lib/timeline'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { BathEntry } from '../types/models'
import {
  deleteBathEntry,
  getAllBathEntries,
  importBathEntries,
  logBath,
  subscribeToBathEntriesInRange,
  subscribeToRecentBathEntries,
  updateBathEntry,
} from './bathEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return {
    ...actual,
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    onSnapshot: vi.fn(),
    getDocs: vi.fn(),
    writeBatch: vi.fn(),
  }
})

const addDocMock = vi.mocked(addDoc)
const updateDocMock = vi.mocked(updateDoc)
const deleteDocMock = vi.mocked(deleteDoc)
const onSnapshotMock = vi.mocked(onSnapshot)
const getDocsMock = vi.mocked(getDocs)
const writeBatchMock = vi.mocked(writeBatch)

describe('bathEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    deleteDocMock.mockReset()
    onSnapshotMock.mockReset()
    getDocsMock.mockReset()
    writeBatchMock.mockReset()
  })

  it('logs a bath with the given time and notes', async () => {
    await logBath('h1', 'b1', 'uid1', {
      occurredAt: new Date('2026-03-05T08:00:00.000Z'),
      notes: 'after bath',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ notes: 'after bath', createdBy: 'uid1' })
  })

  it('updates a bath entry', async () => {
    await updateBathEntry('h1', 'b1', 'd1', {
      occurredAt: new Date('2026-03-05T08:00:00.000Z'),
      notes: 'corrected',
    })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ notes: 'corrected' })
  })

  it('deletes a bath entry', async () => {
    await deleteBathEntry('h1', 'b1', 'd1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('maps today bath entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              occurredAt: Timestamp.fromDate(new Date('2026-03-05T08:00:00.000Z')),
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-03-05T08:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToBathEntriesInRange(
      'h1',
      'b1',
      dayRange(new Date('2026-03-05T12:00:00.000Z')),
      onChange,
    )

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1' })])
  })

  it('maps the most recent bath entries regardless of date range', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              occurredAt: Timestamp.fromDate(new Date('2026-02-01T08:00:00.000Z')),
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-02-01T08:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToRecentBathEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1' })])
  })

  it('fetches every bath entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'entry1',
          data: {
            occurredAt: Timestamp.fromDate(new Date('2026-01-01T08:00:00.000Z')),
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T08:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllBathEntries('h1', 'b1')

    expect(entries).toEqual([expect.objectContaining({ id: 'entry1' })])
  })

  it('imports bath entries in a batch', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: BathEntry = {
      id: 'old-id',
      occurredAt: '2026-01-01T08:00:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T08:00:00.000Z',
    }

    await importBathEntries('h1', 'b1', [entry])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ createdBy: 'uid1' })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('bathEntries queries and robustness', () => {
  const range = dayRange(new Date('2026-03-05T12:00:00.000Z'))
  const AT_ISO = '2026-03-05T08:00:00.000Z'
  const at = Timestamp.fromDate(new Date(AT_ISO))

  beforeEach(() => {
    onSnapshotMock.mockReset().mockReturnValue(vi.fn())
    getDocsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes to the entries of the range [start, end), latest first', () => {
    subscribeToBathEntriesInRange('h1', 'b1', range, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(
        bathEntriesCollection('h1', 'b1'),
        where('occurredAt', '>=', Timestamp.fromDate(range.start)),
        where('occurredAt', '<', Timestamp.fromDate(range.end)),
        orderBy('occurredAt', 'desc'),
      ),
    )
  })

  it('subscribes to the latest entries, limited to the count', () => {
    subscribeToRecentBathEntries('h1', 'b1', 5, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(bathEntriesCollection('h1', 'b1'), orderBy('occurredAt', 'desc'), limit(5)),
    )
  })

  it('reads every entry oldest first for the export', async () => {
    getDocsMock.mockResolvedValue(fakeSnapshot([]))

    await getAllBathEntries('h1', 'b1')

    expectQuery(getDocsMock.mock.calls[0][0], query(bathEntriesCollection('h1', 'b1'), orderBy('occurredAt')))
  })

  it('defaults the fields a legacy document lacks, createdAt included', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'legacy', data: { occurredAt: at, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentBathEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([
      { id: 'legacy', occurredAt: AT_ISO, notes: '', createdBy: 'uid1', createdAt: AT_ISO },
    ])
  })

  it('skips a document without occurredAt instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'broken', data: { createdBy: 'uid1' } }, { id: 'legacy', data: { occurredAt: at, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentBathEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'legacy' })])
    expect(warn).toHaveBeenCalledWith('[firestore] skipping malformed document', 'fake/broken', expect.any(Error))
  })

  it('forwards listener errors to onError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, _next: unknown, error: (e: Error) => void) => {
      error(new Error('permission-denied'))
      return vi.fn()
    }) as never)

    subscribeToBathEntriesInRange('h1', 'b1', range, vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})
