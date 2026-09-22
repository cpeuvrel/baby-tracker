import { addDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSnapshot } from '../test/fakeSnapshot'
import { logMedication, subscribeToRecentMedicationEntries } from './medicationEntries'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, addDoc: vi.fn(), onSnapshot: vi.fn() }
})

const addDocMock = vi.mocked(addDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

describe('medicationEntries repository', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    onSnapshotMock.mockReset()
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
})
