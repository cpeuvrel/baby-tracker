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
import { dayRange } from '../lib/timeline'
import { medicationEntriesCollection } from '../lib/paths'
import { expectQuery } from '../test/expectQuery'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { MedicationEntry } from '../types/models'
import {
  deleteMedicationEntry,
  getAllMedicationEntries,
  importMedicationEntries,
  logMedication,
  subscribeToRecentMedicationEntries,
  updateMedicationEntry,
  subscribeToMedicationEntriesInRange,
} from './medicationEntries'

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

describe('medicationEntries repository', () => {
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

  it('logs a medication entry with the given name and dose', async () => {
    await logMedication('h1', 'b1', 'uid1', {
      name: 'Vitamin D',
      givenAt: new Date('2026-03-05T09:00:00.000Z'),
      dose: '2 drops',
      notes: '',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ name: 'Vitamin D', dose: '2 drops', createdBy: 'uid1' })
    expect((payload as { givenAt: Timestamp }).givenAt).toBeInstanceOf(Timestamp)
  })

  it('updates a medication entry', async () => {
    await updateMedicationEntry('h1', 'b1', 'm1', {
      name: 'Vitamin D',
      givenAt: new Date('2026-03-05T09:00:00.000Z'),
      dose: '3 drops',
      notes: 'corrected',
    })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ dose: '3 drops', notes: 'corrected' })
  })

  it('deletes a medication entry', async () => {
    await deleteMedicationEntry('h1', 'b1', 'm1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('maps the most recent medication entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              name: 'Vitamin D',
              givenAt: Timestamp.fromDate(new Date('2026-03-05T09:00:00.000Z')),
              dose: '2 drops',
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-03-05T09:00:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToRecentMedicationEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'entry1', name: 'Vitamin D' }),
    ])
  })

  it('fetches every medication entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'entry1',
          data: {
            name: 'Vitamin D',
            givenAt: Timestamp.fromDate(new Date('2026-01-01T09:00:00.000Z')),
            dose: '2 drops',
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T09:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllMedicationEntries('h1', 'b1')

    expect(entries).toEqual([expect.objectContaining({ id: 'entry1', name: 'Vitamin D' })])
  })

  it('imports medication entries in a batch', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: MedicationEntry = {
      id: 'old-id',
      name: 'Vitamin D',
      givenAt: '2026-01-01T09:00:00.000Z',
      dose: '2 drops',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T09:00:00.000Z',
    }

    await importMedicationEntries('h1', 'b1', [entry])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ name: 'Vitamin D', dose: '2 drops' })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('medicationEntries queries and robustness', () => {
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
    subscribeToMedicationEntriesInRange('h1', 'b1', range, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(
        medicationEntriesCollection('h1', 'b1'),
        where('givenAt', '>=', Timestamp.fromDate(range.start)),
        where('givenAt', '<', Timestamp.fromDate(range.end)),
        orderBy('givenAt', 'desc'),
      ),
    )
  })

  it('subscribes to the latest entries, limited to the count', () => {
    subscribeToRecentMedicationEntries('h1', 'b1', 5, vi.fn())

    expectQuery(
      onSnapshotMock.mock.calls[0][0],
      query(medicationEntriesCollection('h1', 'b1'), orderBy('givenAt', 'desc'), limit(5)),
    )
  })

  it('reads every entry oldest first for the export', async () => {
    getDocsMock.mockResolvedValue(fakeSnapshot([]))

    await getAllMedicationEntries('h1', 'b1')

    expectQuery(getDocsMock.mock.calls[0][0], query(medicationEntriesCollection('h1', 'b1'), orderBy('givenAt')))
  })

  it('defaults the fields a legacy document lacks, createdAt included', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'legacy', data: { name: 'Vitamin D', givenAt: at, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentMedicationEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([
      { id: 'legacy', name: 'Vitamin D', givenAt: AT_ISO, dose: '', notes: '', createdBy: 'uid1', createdAt: AT_ISO },
    ])
  })

  it('skips a document without givenAt instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation(((_query: unknown, next: (snapshot: unknown) => void) => {
      next(fakeSnapshot([{ id: 'broken', data: { createdBy: 'uid1' } }, { id: 'legacy', data: { name: 'Vitamin D', givenAt: at, createdBy: 'uid1' } }]))
      return vi.fn()
    }) as never)

    subscribeToRecentMedicationEntries('h1', 'b1', 5, onChange)

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

    subscribeToMedicationEntriesInRange('h1', 'b1', range, vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})
