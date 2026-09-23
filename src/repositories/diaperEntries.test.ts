import { addDoc, deleteDoc, getDocs, onSnapshot, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import { fakeSnapshot } from '../test/fakeSnapshot'
import type { DiaperEntry } from '../types/models'
import {
  deleteDiaperEntry,
  getAllDiaperEntries,
  importDiaperEntries,
  logDiaper,
  subscribeToDiaperEntriesInRange,
  subscribeToRecentDiaperEntries,
  updateDiaperEntry,
} from './diaperEntries'

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

describe('diaperEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    deleteDocMock.mockReset()
    onSnapshotMock.mockReset()
    getDocsMock.mockReset()
    writeBatchMock.mockReset()
  })

  it('logs a diaper change with the given type, time and notes', async () => {
    await logDiaper('h1', 'b1', 'uid1', {
      type: 'both',
      occurredAt: new Date('2026-03-05T08:00:00.000Z'),
      notes: 'after bath',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ type: 'both', notes: 'after bath', createdBy: 'uid1' })
  })

  it('updates a diaper entry', async () => {
    await updateDiaperEntry('h1', 'b1', 'd1', {
      type: 'dry',
      occurredAt: new Date('2026-03-05T08:00:00.000Z'),
      notes: 'corrected',
    })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ type: 'dry', notes: 'corrected' })
  })

  it('deletes a diaper entry', async () => {
    await deleteDiaperEntry('h1', 'b1', 'd1')

    expect(deleteDocMock).toHaveBeenCalledTimes(1)
  })

  it('maps today diaper entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'wet',
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

    subscribeToDiaperEntriesInRange(
      'h1',
      'b1',
      dayRange(new Date('2026-03-05T12:00:00.000Z')),
      onChange,
    )

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1', type: 'wet' })])
  })

  it('maps the most recent diaper entries regardless of date range', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'dirty',
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

    subscribeToRecentDiaperEntries('h1', 'b1', 5, onChange)

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1' })])
  })

  it('fetches every diaper entry once for export', async () => {
    getDocsMock.mockResolvedValue(
      fakeSnapshot([
        {
          id: 'entry1',
          data: {
            type: 'wet',
            occurredAt: Timestamp.fromDate(new Date('2026-01-01T08:00:00.000Z')),
            notes: '',
            createdBy: 'uid1',
            createdAt: Timestamp.fromDate(new Date('2026-01-01T08:00:00.000Z')),
          },
        },
      ]),
    )

    const entries = await getAllDiaperEntries('h1', 'b1')

    expect(entries).toEqual([expect.objectContaining({ id: 'entry1', type: 'wet' })])
  })

  it('imports diaper entries in a batch', async () => {
    const set = vi.fn()
    const commit = vi.fn().mockResolvedValue(undefined)
    writeBatchMock.mockReturnValue({ set, commit } as unknown as ReturnType<typeof writeBatch>)

    const entry: DiaperEntry = {
      id: 'old-id',
      type: 'both',
      occurredAt: '2026-01-01T08:00:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-01-01T08:00:00.000Z',
    }

    await importDiaperEntries('h1', 'b1', [entry])

    expect(set).toHaveBeenCalledTimes(1)
    const [, payload] = set.mock.calls[0]
    expect(payload).toMatchObject({ type: 'both', createdBy: 'uid1' })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
