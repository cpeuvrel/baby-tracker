import { addDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { logDiaper, subscribeToDiaperEntriesInRange } from './diaperEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('diaperEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    onSnapshotMock.mockReset()
  })

  it('logs a diaper change with the given type and notes', async () => {
    await logDiaper('h1', 'b1', 'uid1', 'both', 'après le bain')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ type: 'both', notes: 'après le bain', createdBy: 'uid1' })
  })

  it('maps today diaper entries from a snapshot', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_query, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeSnapshot([
          {
            id: 'entry1',
            data: {
              type: 'pee',
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

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'entry1', type: 'pee' })])
  })
})
