import { addDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import { fakeSnapshot } from '../test/fakeSnapshot'
import {
  logSolidFeeding,
  startBottleFeeding,
  stopBottleFeeding,
  subscribeToActiveBottleFeeding,
  subscribeToFeedingEntriesInRange,
} from './feedingEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), updateDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const updateDocMock = vi.mocked(updateDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('feedingEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    updateDocMock.mockReset()
    onSnapshotMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates an in-progress bottle entry on start', async () => {
    await startBottleFeeding('h1', 'b1', 'uid1')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({
      type: 'bottle',
      endedAt: null,
      durationSeconds: null,
      volumeMl: null,
      createdBy: 'uid1',
    })
    expect((payload as { startedAt: Timestamp }).startedAt).toBeInstanceOf(Timestamp)
  })

  it('closes a bottle entry with computed duration and volume on stop', async () => {
    const startedAt = new Date('2026-03-05T09:59:30.000Z')

    await stopBottleFeeding('h1', 'b1', 'entry1', startedAt, 150)

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ durationSeconds: 30, volumeMl: 150 })
  })

  it('logs an instant solid feeding entry with zero duration', async () => {
    await logSolidFeeding('h1', 'b1', 'uid1', 'purée carotte')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({
      type: 'solid',
      durationSeconds: 0,
      volumeMl: null,
      notes: 'purée carotte',
      createdBy: 'uid1',
    })
  })

  it('reports the active bottle entry when one exists', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'bottle',
              startedAt: Timestamp.fromDate(new Date('2026-03-05T09:50:00.000Z')),
              endedAt: null,
              durationSeconds: null,
              volumeMl: null,
              notes: '',
              createdBy: 'uid1',
              createdAt: Timestamp.fromDate(new Date('2026-03-05T09:50:00.000Z')),
            },
          },
        ]),
      )
      return vi.fn()
    })

    subscribeToActiveBottleFeeding('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'entry1', type: 'bottle', endedAt: null }),
    )
  })

  it('reports null when there is no active bottle entry', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(fakeSnapshot([]))
      return vi.fn()
    })

    subscribeToActiveBottleFeeding('h1', 'b1', onChange)

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('maps today feeding entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'solid',
              startedAt: Timestamp.fromDate(new Date('2026-03-05T08:00:00.000Z')),
              endedAt: Timestamp.fromDate(new Date('2026-03-05T08:00:00.000Z')),
              durationSeconds: 0,
              volumeMl: null,
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
      expect.objectContaining({ id: 'entry1', type: 'solid' }),
    ])
  })
})
