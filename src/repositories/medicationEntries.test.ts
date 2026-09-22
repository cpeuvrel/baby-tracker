import { addDoc, getDocs, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { MedicationEntry } from '../types/models'
import {
  getAllMedicationEntries,
  importMedicationEntries,
  logMedication,
  subscribeToRecentMedicationEntries,
} from './medicationEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn(), getDocs: vi.fn(), writeBatch: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)
const getDocsMock = vi.mocked(getDocs)
const writeBatchMock = vi.mocked(writeBatch)

describe('medicationEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
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
      name: 'Vitamine D',
      givenAt: new Date('2026-03-05T09:00:00.000Z'),
      dose: '2 gouttes',
      notes: '',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ name: 'Vitamine D', dose: '2 gouttes', createdBy: 'uid1' })
    expect((payload as { givenAt: Timestamp }).givenAt).toBeInstanceOf(Timestamp)
  })

  it('maps the most recent medication entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              name: 'Vitamine D',
              givenAt: Timestamp.fromDate(new Date('2026-03-05T09:00:00.000Z')),
              dose: '2 gouttes',
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
      expect.objectContaining({ id: 'entry1', name: 'Vitamine D' }),
    ])
  })

  it('fetches every medication entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'entry1',
          data: {
            name: 'Vitamine D',
            givenAt: Timestamp.fromDate(new Date('2026-01-01T09:00:00.000Z')),
            dose: '2 gouttes',
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T09:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllMedicationEntries('h1', 'b1')

    expect(entries).toEqual([expect.objectContaining({ id: 'entry1', name: 'Vitamine D' })])
  })

  it('imports medication entries in a batch', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: MedicationEntry = {
      id: 'old-id',
      name: 'Vitamine D',
      givenAt: '2026-01-01T09:00:00.000Z',
      dose: '2 gouttes',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T09:00:00.000Z',
    }

    await importMedicationEntries('h1', 'b1', [entry])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ name: 'Vitamine D', dose: '2 gouttes' })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
