import { onSnapshot, setDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setReminder, subscribeToReminder } from './reminders'

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, setDoc: vi.fn(), onSnapshot: vi.fn() }
})

const setDocMock = vi.mocked(setDoc)
const onSnapshotMock = vi.mocked(onSnapshot)

function fakeDocSnapshot(exists: boolean, id: string, data?: Record<string, unknown>) {
  return { exists: () => exists, id, data: () => data }
}

describe('reminders repository', () => {
  beforeEach(() => {
    setDocMock.mockReset()
    onSnapshotMock.mockReset()
  })

  it('upserts a reminder for the given medication', async () => {
    await setReminder('h1', 'b1', 'Vitamine D', '09:00', true)

    expect(setDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = setDocMock.mock.calls[0]
    expect(payload).toEqual({ medicationName: 'Vitamine D', timeOfDay: '09:00', active: true })
  })

  it('reports the reminder when the document exists', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_ref, callback) => {
      ;(callback as (snapshot: unknown) => void)(
        fakeDocSnapshot(true, 'Vitamine D', {
          medicationName: 'Vitamine D',
          timeOfDay: '09:00',
          active: true,
        }),
      )
      return vi.fn()
    })

    subscribeToReminder('h1', 'b1', 'Vitamine D', onChange)

    expect(onChange).toHaveBeenCalledWith({
      id: 'Vitamine D',
      medicationName: 'Vitamine D',
      timeOfDay: '09:00',
      active: true,
    })
  })

  it('reports null when no reminder document exists yet', () => {
    const onChange = vi.fn()
    onSnapshotMock.mockImplementation((_ref, callback) => {
      ;(callback as (snapshot: unknown) => void)(fakeDocSnapshot(false, 'Vitamine D'))
      return vi.fn()
    })

    subscribeToReminder('h1', 'b1', 'Vitamine D', onChange)

    expect(onChange).toHaveBeenCalledWith(null)
  })
})
