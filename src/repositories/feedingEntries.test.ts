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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedingEntriesCollection } from '../lib/paths'
import { dayRange } from '../lib/timeline'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { FeedingEntry } from '../types/models'
import {
  deleteFeedingEntry,
  getAllFeedingEntries,
  importFeedingEntries,
  logFeeding,
  subscribeToFeedingEntriesInRange,
  subscribeToRecentFeedingEntries,
  updateFeedingEntry,
} from './feedingEntries'

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

describe('feedingEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    deleteDocMock.mockReset()
    onSnapshotMock.mockReset()
    getDocsMock.mockReset()
    writeBatchMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('logs an instant bottle entry with the given volume', async () => {
    await logFeeding('h1', 'b1', 'uid1', {
      type: 'bottle',
      occurredAt: new Date('2026-03-05T09:45:00.000Z'),
      volumeMl: 120,
      foodType: null,
      notes: '',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ type: 'bottle', volumeMl: 120, foodType: null, createdBy: 'uid1' })
    expect((payload as { occurredAt: Timestamp }).occurredAt).toBeInstanceOf(Timestamp)
  })

  it('logs an instant solid entry with the given food type', async () => {
    await logFeeding('h1', 'b1', 'uid1', {
      type: 'solid',
      occurredAt: new Date('2026-03-05T09:45:00.000Z'),
      volumeMl: null,
      foodType: 'carrot purée',
      notes: '',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ type: 'solid', volumeMl: null, foodType: 'carrot purée' })
  })

  it('updates a feeding entry', async () => {
    await updateFeedingEntry('h1', 'b1', 'f1', {
      type: 'bottle',
      occurredAt: new Date('2026-03-05T09:45:00.000Z'),
      volumeMl: 150,
      foodType: null,
      notes: 'corrected',
    })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ volumeMl: 150, notes: 'corrected' })
  })

  it('deletes a feeding entry', async () => {
    await deleteFeedingEntry('h1', 'b1', 'f1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('maps feeding entries from a snapshot in range', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'bottle',
              occurredAt: Timestamp.fromDate(new Date('2026-03-05T08:00:00.000Z')),
              volumeMl: 90,
              foodType: null,
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-03-05T08:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToFeedingEntriesInRange(
      'h1',
      'b1',
      dayRange(new Date('2026-03-05T12:00:00.000Z')),
      onChange,
    )

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'entry1', type: 'bottle', volumeMl: 90 }),
    ])
  })

  it('maps the most recent feeding entries regardless of date range', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'solid',
              occurredAt: Timestamp.fromDate(new Date('2026-02-01T08:00:00.000Z')),
              volumeMl: null,
              foodType: 'purée',
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-02-01T08:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToRecentFeedingEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1' })])
  })

  it('fetches every feeding entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'entry1',
          data: {
            type: 'bottle',
            occurredAt: Timestamp.fromDate(new Date('2026-01-01T08:00:00.000Z')),
            volumeMl: 100,
            foodType: null,
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T08:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllFeedingEntries('h1', 'b1')

    expect(entries).toEqual([
      expect.objectContaining({ id: 'entry1', type: 'bottle', volumeMl: 100 }),
    ])
  })

  it('imports feeding entries in a batch', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: FeedingEntry = {
      id: 'old-id',
      type: 'bottle',
      occurredAt: '2026-01-01T08:00:00.000Z',
      volumeMl: 100,
      foodType: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T08:00:00.000Z',
    }

    await importFeedingEntries('h1', 'b1', [entry])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ type: 'bottle', volumeMl: 100, createdBy: 'uid1' })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('feedingEntries queries and robustness', () => {
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
    subscribeToFeedingEntriesInRange('h1', 'b1', range, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(
        feedingEntriesCollection('h1', 'b1'),
        where('occurredAt', '>=', Timestamp.fromDate(range.start)),
        where('occurredAt', '<', Timestamp.fromDate(range.end)),
        orderBy('occurredAt', 'desc'),
      ),
    )
  })

  it('subscribes to the latest entries, limited to the count', () => {
    subscribeToRecentFeedingEntries('h1', 'b1', 5, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(feedingEntriesCollection('h1', 'b1'), orderBy('occurredAt', 'desc'), limit(5)),
    )
  })

  it('reads every entry oldest first for the export', async () => {
    getDocsMock.mockResolvedValue(fakeSnapshot([]))

    await getAllFeedingEntries('h1', 'b1')

    expectQuery(getDocsMock.mock.calls[0][0], query(feedingEntriesCollection('h1', 'b1'), orderBy('occurredAt')))
  })

  it('defaults the fields a legacy document lacks, createdAt included', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'legacy', data: { type: 'bottle', occurredAt: at, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentFeedingEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([
      { id: 'legacy', type: 'bottle', occurredAt: AT_ISO, volumeMl: null, foodType: null, notes: '', createdBy: 'uid1', createdAt: AT_ISO },
    ])
  })

  it('skips a document without occurredAt instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'broken', data: { createdBy: 'uid1' } }, { id: 'legacy', data: { type: 'bottle', occurredAt: at, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentFeedingEntries('h1', 'b1', 5, onChange)

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

    subscribeToFeedingEntriesInRange('h1', 'b1', range, vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})
