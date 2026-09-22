import { addDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import { fakeSnapshot } from '../test/fakeSnapshot'
import {
  startSleep,
  stopSleep,
  subscribeToActiveSleep,
  subscribeToRecentSleepEntries,
  subscribeToSleepEntriesInRange,
} from './sleepEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const updateDocMock = vi.mocked(updateDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('sleepEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    onSnapshotMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T22:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates an in-progress sleep entry on start', async () => {
    await startSleep('h1', 'b1', 'uid1')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ endedAt: null, durationSeconds: null, createdBy: 'uid1' })
  })

  it('closes a sleep entry with the elapsed duration on stop', async () => {
    const startedAt = new Date('2026-03-05T20:30:00.000Z')

    await stopSleep('h1', 'b1', 'entry1', startedAt)

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ durationSeconds: 90 * 60 })
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

    subscribeToActiveSleep('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry1', endedAt: null }))
  })

  it('reports null when there is no active sleep entry', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(fakeSnapshot([]))
      return vi.fn()
    })

    subscribeToActiveSleep('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith(null)
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
})
