import { onSnapshot, setDoc } from 'firebase/firestore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reminderDocId, setReminder, subscribeToReminder } from './reminders'

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
    const [ref, payload] = setDocMock.mock.calls[0]
    expect((ref as { path: string }).path).toBe('households/h1/babies/b1/reminders/Vitamine D')
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

    const [ref] = onSnapshotMock.mock.calls[0]
    expect((ref as unknown as { path: string }).path).toBe('households/h1/babies/b1/reminders/Vitamine D')
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

describe('reminder document ids', () => {
  beforeEach(() => {
    setDocMock.mockReset()
    onSnapshotMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a name that is already a valid id, so existing reminders are still found', () => {
    expect(reminderDocId('Vitamin D')).toBe('Vitamin D')
  })

  it.each([
    ['Vitamin/Probiotic', '~Vitamin%2FProbiotic'],
    ['', '~'],
    ['.', '~.'],
    ['..', '~..'],
    ['__name__', '~__name__'],
  ])('encodes %j, which Firestore rejects as an id', (name, id) => {
    expect(reminderDocId(name)).toBe(id)
  })

  it('stores a reminder for a name containing a slash', async () => {
    await setReminder('h1', 'b1', 'Vitamin/Probiotic', '09:00', true)

    const [ref, payload] = setDocMock.mock.calls[0]
    expect((ref as { path: string }).path).toBe('households/h1/babies/b1/reminders/~Vitamin%2FProbiotic')
    expect(payload).toEqual({ medicationName: 'Vitamin/Probiotic', timeOfDay: '09:00', active: true })
  })

  it('subscribes to a reminder for a name containing a slash', () => {
    onSnapshotMock.mockReturnValue(vi.fn())

    expect(() => subscribeToReminder('h1', 'b1', 'Vitamin/Probiotic', vi.fn())).not.toThrow()
    const [ref] = onSnapshotMock.mock.calls[0]
    expect((ref as unknown as { path: string }).path).toBe('households/h1/babies/b1/reminders/~Vitamin%2FProbiotic')
  })

  it('forwards listener errors to onError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    onSnapshotMock.mockImplementation(((_ref: unknown, _next: unknown, error: (e: Error) => void) => {
      error(new Error('permission-denied'))
      return vi.fn()
    }) as never)

    subscribeToReminder('h1', 'b1', 'Vitamin D', vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith(new Error('permission-denied'))
  })
})
