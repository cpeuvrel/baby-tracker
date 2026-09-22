import { addDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { addGrowthEntry, subscribeToGrowthEntries } from './growthEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('growthEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    onSnapshotMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a growth measurement with the given values', async () => {
    await addGrowthEntry('h1', 'b1', 'uid1', {
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: 410,
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
})
