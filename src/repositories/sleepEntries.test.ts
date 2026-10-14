import {
  addDoc,
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sleepEntriesCollection } from '../lib/paths'
import { dayRange } from '../lib/timeline'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { SleepEntry } from '../types/models'
import {
  deleteSleepEntry,
  getAllSleepEntries,
  importSleepEntries,
  logSleep,
  startSleep,
  resumeSleep,
  stopSleep,
  subscribeToActiveSleeps,
  subscribeToRecentSleepEntries,
  subscribeToSleepEntriesInRange,
  updateSleepEntry,
} from './sleepEntries'

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

function mockBatch() {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }
  writeBatchMock.mockReturnValue(batch as unknown as ReturnType<typeof writeBatch>)
  return batch
}

function pathOf(ref: unknown): string {
  return (ref as { path: string }).path
}

describe('sleepEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    deleteDocMock.mockReset()
    onSnapshotMock.mockReset()
    getDocsMock.mockReset()
    writeBatchMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T22:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates an in-progress sleep entry on start, taking the sleep timer lock in the same write', async () => {
    const batch = mockBatch()
    await startSleep('h1', 'b1', 'uid1')

    expect(batch.set).toHaveBeenCalledTimes(2)
    const [entryRef, payload] = batch.set.mock.calls[0]
    expect(payload).toMatchObject({ endedAt: null, durationSeconds: null, createdBy: 'uid1' })
    // Started now: the server's clock, not the phone's.
    expect((payload as { startedAt: unknown }).startedAt).toEqual(serverTimestamp())
    const [lockRef, lock] = batch.set.mock.calls[1]
    expect(pathOf(lockRef)).toBe('households/h1/babies/b1/locks/sleepTimer')
    expect(lock).toEqual({ entryId: (entryRef as { id: string }).id })
    expect(batch.commit).toHaveBeenCalledTimes(1)
  })

  it('creates an in-progress sleep entry with a given start time', async () => {
    const batch = mockBatch()
    await startSleep('h1', 'b1', 'uid1', new Date('2026-03-05T20:00:00.000Z'))

    const [, payload] = batch.set.mock.calls[0]
    expect((payload as { startedAt: Timestamp }).startedAt.toDate()).toEqual(
      new Date('2026-03-05T20:00:00.000Z'),
    )
  })

  it('fails the start when the write is refused (another sleep runs)', async () => {
    const batch = mockBatch()
    batch.commit.mockRejectedValue(new Error('permission-denied'))

    await expect(startSleep('h1', 'b1', 'uid1')).rejects.toThrow('permission-denied')
  })

  it('logs a completed sleep entry directly, computing the duration', async () => {
    await logSleep('h1', 'b1', 'uid1', {
      startedAt: new Date('2026-03-05T20:00:00.000Z'),
      endedAt: new Date('2026-03-05T21:30:00.000Z'),
      notes: 'sieste',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ durationSeconds: 90 * 60, notes: 'sieste', createdBy: 'uid1' })
  })

  it("ends a sleep at the server's time on stop, not the phone's", async () => {
    await stopSleep('h1', 'b1', 'entry1')

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [entryRef, payload] = updateDocMock.mock.calls[0]
    expect(pathOf(entryRef)).toBe('households/h1/babies/b1/sleepEntries/entry1')
    expect(payload).toEqual({ endedAt: serverTimestamp(), durationSeconds: null })
  })

  it('resumes a stopped sleep by clearing its end and duration', async () => {
    const batch = mockBatch()
    const startedAt = new Date('2026-03-05T20:00:00.000Z')
    await resumeSleep('h1', 'b1', 'entry1', startedAt)

    const [entryRef, payload] = batch.update.mock.calls[0]
    expect(pathOf(entryRef)).toBe('households/h1/babies/b1/sleepEntries/entry1')
    expect(payload).toEqual({ startedAt: Timestamp.fromDate(startedAt), endedAt: null, durationSeconds: null })
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), { entryId: 'entry1' })
  })

  it('resumes a stopped sleep with its edited notes in the same write', async () => {
    const batch = mockBatch()
    const startedAt = new Date('2026-03-05T20:00:00.000Z')
    await resumeSleep('h1', 'b1', 'entry1', startedAt, 'fell back asleep')

    const [, payload] = batch.update.mock.calls[0]
    expect(payload).toEqual({
      startedAt: Timestamp.fromDate(startedAt),
      endedAt: null,
      durationSeconds: null,
      notes: 'fell back asleep',
    })
  })

  it('starts a sleep with notes typed before the start', async () => {
    const batch = mockBatch()
    await startSleep('h1', 'b1', 'uid1', new Date('2026-03-05T20:00:00.000Z'), 'nursed to sleep')

    const [, payload] = batch.set.mock.calls[0]
    expect(payload).toMatchObject({ notes: 'nursed to sleep' })
  })

  it('updates a sleep entry, recomputing the duration from start/end', async () => {
    await updateSleepEntry('h1', 'b1', 'entry1', {
      startedAt: new Date('2026-03-05T20:00:00.000Z'),
      endedAt: new Date('2026-03-05T21:30:00.000Z'),
      notes: 'corrected',
    })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ durationSeconds: 90 * 60, notes: 'corrected' })
  })

  it('updates a sleep entry back to in-progress when the end time is cleared, taking the lock', async () => {
    const batch = mockBatch()
    await updateSleepEntry('h1', 'b1', 'entry1', {
      startedAt: new Date('2026-03-05T20:00:00.000Z'),
      endedAt: null,
      notes: '',
    })

    expect(updateDocMock).not.toHaveBeenCalled()
    const [, payload] = batch.update.mock.calls[0]
    expect(payload).toMatchObject({ endedAt: null, durationSeconds: null })
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), { entryId: 'entry1' })
  })

  it('deletes a sleep entry', async () => {
    await deleteSleepEntry('h1', 'b1', 'entry1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('reports the active sleep entry when one exists', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              startedAt: Timestamp.fromDate(new Date('2026-03-05T21:00:00.000Z')),
              endedAt: null,
              durationSeconds: null,
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-03-05T21:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToActiveSleeps('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1', endedAt: null })])
  })

  it('reports every sleep running, earliest first', () => {
    const onChange = vi.fn()
    const running = (startedAt: string) => ({
      startedAt: Timestamp.fromDate(new Date(startedAt)),
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: Timestamp.fromDate(new Date(startedAt)),
    })
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          { id: 'later', data: running('2026-03-05T21:05:00.000Z') },
          { id: 'earlier', data: running('2026-03-05T21:00:00.000Z') },
        ]),
      )
      return vi.fn()
    })

    subscribeToActiveSleeps('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'earlier' }),
      expect.objectContaining({ id: 'later' }),
    ])
  })

  it('reports no sleep when none runs', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(fakeSnapshot([]))
      return vi.fn()
    })

    subscribeToActiveSleeps('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('maps today sleep entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              startedAt: Timestamp.fromDate(new Date('2026-03-05T13:00:00.000Z')),
              endedAt: Timestamp.fromDate(new Date('2026-03-05T14:00:00.000Z')),
              durationSeconds: 3600,
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-03-05T13:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToSleepEntriesInRange(
      'h1',
      'b1',
      dayRange(new Date('2026-03-05T15:00:00.000Z')),
      onChange,
    )

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'entry1', durationSeconds: 3600 }),
    ])
  })

  it('maps the most recent sleep entries regardless of date range', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              startedAt: Timestamp.fromDate(new Date('2026-02-01T13:00:00.000Z')),
              endedAt: Timestamp.fromDate(new Date('2026-02-01T14:00:00.000Z')),
              durationSeconds: 3600,
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-02-01T13:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToRecentSleepEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1' })])
  })

  it('fetches every sleep entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'entry1',
          data: {
            startedAt: Timestamp.fromDate(new Date('2026-01-01T20:00:00.000Z')),
            endedAt: Timestamp.fromDate(new Date('2026-01-01T21:00:00.000Z')),
            durationSeconds: 3600,
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T20:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllSleepEntries('h1', 'b1')

    expect(entries).toEqual([expect.objectContaining({ id: 'entry1', durationSeconds: 3600 })])
  })

  it('imports sleep entries in a batch, leaving out a timer still running in the export', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: SleepEntry = {
      id: 'old-id',
      startedAt: '2026-01-01T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T20:00:00.000Z',
    }

    const stopped: SleepEntry = {
      ...entry,
      id: 'stopped-id',
      endedAt: '2026-01-01T21:00:00.000Z',
      durationSeconds: 3600,
    }

    await importSleepEntries('h1', 'b1', [entry, stopped])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ durationSeconds: 3600 })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('sleepEntries queries and robustness', () => {
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
    subscribeToSleepEntriesInRange('h1', 'b1', range, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(
        sleepEntriesCollection('h1', 'b1'),
        where('startedAt', '>=', Timestamp.fromDate(range.start)),
        where('startedAt', '<', Timestamp.fromDate(range.end)),
        orderBy('startedAt', 'desc'),
      ),
    )
  })

  it('subscribes to the latest entries, limited to the count', () => {
    subscribeToRecentSleepEntries('h1', 'b1', 5, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(sleepEntriesCollection('h1', 'b1'), orderBy('startedAt', 'desc'), limit(5)),
    )
  })

  it('reads every entry oldest first for the export', async () => {
    getDocsMock.mockResolvedValue(fakeSnapshot([]))

    await getAllSleepEntries('h1', 'b1')

    expectQuery(getDocsMock.mock.calls[0][0], query(sleepEntriesCollection('h1', 'b1'), orderBy('startedAt')))
  })

  it('defaults the fields a legacy document lacks, createdAt included', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'legacy', data: { startedAt: at, endedAt: Timestamp.fromDate(new Date('2026-03-05T09:00:00.000Z')), createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentSleepEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([
      { id: 'legacy', startedAt: AT_ISO, endedAt: '2026-03-05T09:00:00.000Z', durationSeconds: 3600, notes: '', createdBy: 'uid1', createdAt: AT_ISO },
    ])
  })

  it('skips a document without startedAt instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'broken', data: { createdBy: 'uid1' } }, { id: 'legacy', data: { startedAt: at, endedAt: Timestamp.fromDate(new Date('2026-03-05T09:00:00.000Z')), createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentSleepEntries('h1', 'b1', 5, onChange)

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

    subscribeToSleepEntriesInRange('h1', 'b1', range, vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})

describe('subscribeToActiveSleeps query', () => {
  beforeEach(() => {
    onSnapshotMock.mockReset().mockReturnValue(vi.fn())
  })

  it('subscribes to the sleeps without an end', () => {
    subscribeToActiveSleeps('h1', 'b1', vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(sleepEntriesCollection('h1', 'b1'), where('endedAt', '==', null)),
    )
  })
})
