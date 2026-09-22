import { addDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import { fakeSnapshot } from '../test/fakeSnapshot'
import {
  logFeeding,
  subscribeToFeedingEntriesInRange,
  subscribeToRecentFeedingEntries,
} from './feedingEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('feedingEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    onSnapshotMock.mockReset()
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
      foodType: 'purée carotte',
      notes: '',
    })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ type: 'solid', volumeMl: null, foodType: 'purée carotte' })
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
})
