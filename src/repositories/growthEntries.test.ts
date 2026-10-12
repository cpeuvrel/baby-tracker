import {
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { growthEntriesCollection } from '../lib/paths'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { GrowthEntry } from '../types/models'
import {
  addGrowthEntry,
  deleteGrowthEntry,
  getAllGrowthEntries,
  importGrowthEntries,
  subscribeToGrowthEntries,
  updateGrowthEntry,
} from './growthEntries'

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

describe('growthEntries repository', () => {
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

  it('adds a growth measurement with the given values', async () => {
    await addGrowthEntry('h1', 'b1', 'uid1', {
      measuredAt: new Date('2026-03-05T10:00:00.000Z'),
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: 410,
      notes: '',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: 410,
      createdBy: 'uid1',
    })
  })

  it('updates a growth measurement', async () => {
    await updateGrowthEntry('h1', 'b1', 'g1', {
      measuredAt: new Date('2026-03-05T10:00:00.000Z'),
      weightG: 6300,
      heightMm: 621,
      headCircumferenceMm: 411,
      notes: 'fasting',
    })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ weightG: 6300, notes: 'fasting' })
  })

  it('deletes a growth measurement', async () => {
    await deleteGrowthEntry('h1', 'b1', 'g1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('maps growth entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'g1',
            data: {
              measuredAt: Timestamp.fromDate(new Date('2026-02-01T10:00:00.000Z')),
              weightG: 5800,
              heightMm: 590,
              headCircumferenceMm: 400,
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-02-01T10:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToGrowthEntries('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'g1', weightG: 5800, heightMm: 590 }),
    ])
  })

  it('fetches every growth entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'g1',
          data: {
            measuredAt: Timestamp.fromDate(new Date('2026-01-01T10:00:00.000Z')),
            weightG: 5000,
            heightMm: 550,
            headCircumferenceMm: 380,
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T10:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllGrowthEntries('h1', 'b1')

    expect(entries).toEqual([expect.objectContaining({ id: 'g1', weightG: 5000 })])
  })

  it('imports growth entries in a batch', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: GrowthEntry = {
      id: 'old-id',
      measuredAt: '2026-01-01T10:00:00.000Z',
      weightG: 5000,
      heightMm: 550,
      headCircumferenceMm: 380,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T10:00:00.000Z',
    }

    await importGrowthEntries('h1', 'b1', [entry])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ weightG: 5000, heightMm: 550 })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('growthEntries queries and robustness', () => {
  const AT_ISO = '2026-03-05T08:00:00.000Z'
  const at = Timestamp.fromDate(new Date(AT_ISO))

  beforeEach(() => {
    onSnapshotMock.mockReset().mockReturnValue(vi.fn())
    getDocsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes to every entry, oldest first', () => {
    subscribeToGrowthEntries('h1', 'b1', vi.fn())

    expectQuery(onSnapshotMock.mock.calls[0][0], query(growthEntriesCollection('h1', 'b1'), orderBy('measuredAt')))
  })

  it('reads every entry oldest first for the export', async () => {
    getDocsMock.mockResolvedValue(fakeSnapshot([]))

    await getAllGrowthEntries('h1', 'b1')

    expectQuery(getDocsMock.mock.calls[0][0], query(growthEntriesCollection('h1', 'b1'), orderBy('measuredAt')))
  })

  it('defaults the fields a legacy document lacks, createdAt included', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'legacy', data: { measuredAt: at, weightG: 4200, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToGrowthEntries('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith([
      { id: 'legacy', measuredAt: AT_ISO, weightG: 4200, heightMm: null, headCircumferenceMm: null, notes: '', createdBy: 'uid1', createdAt: AT_ISO },
    ])
  })

  it('skips a document without measuredAt instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'broken', data: { createdBy: 'uid1' } }, { id: 'legacy', data: { measuredAt: at, weightG: 4200, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToGrowthEntries('h1', 'b1', onChange)

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

    subscribeToGrowthEntries('h1', 'b1', vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})
