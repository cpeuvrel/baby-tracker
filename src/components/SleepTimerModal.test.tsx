import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { SleepEntry } from '../types/models'
import { SleepTimerModal } from './SleepTimerModal'
import { dateTimeValue, setDateTime } from '../test/timeFields'

const startSleep = vi.fn().mockResolvedValue(undefined)
const stopSleep = vi.fn().mockResolvedValue(undefined)
const logSleep = vi.fn().mockResolvedValue(undefined)
const updateSleepEntry = vi.fn().mockResolvedValue(undefined)
const resumeSleep = vi.fn().mockResolvedValue(undefined)
const updateSleepStart = vi.fn().mockResolvedValue(undefined)
const updateSleepNotes = vi.fn().mockResolvedValue(undefined)

const registerPush = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/pushRegistration', () => ({
  registerPush: (...args: unknown[]) => registerPush(...args),
}))

vi.mock('../repositories/sleepEntries', () => ({
  resumeSleep: (...args: unknown[]) => resumeSleep(...args),
  startSleep: (...args: unknown[]) => startSleep(...args),
  stopSleep: (...args: unknown[]) => stopSleep(...args),
  logSleep: (...args: unknown[]) => logSleep(...args),
  updateSleepEntry: (...args: unknown[]) => updateSleepEntry(...args),
  updateSleepStart: (...args: unknown[]) => updateSleepStart(...args),
  updateSleepNotes: (...args: unknown[]) => updateSleepNotes(...args),
}))

/** Mocks the running sleeps the modal sees; call the returned function to change them. */
function mockActiveSleeps(entries: SleepEntry[]) {
  const spy = vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntriesState')
  const set = (next: SleepEntry[]) => spy.mockReturnValue({ entries: next, loading: false, error: null })
  set(entries)
  return set
}

const runningSleep: SleepEntry = {
  id: 'sleep1',
  startedAt: '2026-03-05T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T20:00:00.000Z',
}

describe('SleepTimerModal', () => {
  beforeEach(() => {
    startSleep.mockReset().mockResolvedValue(undefined)
    stopSleep.mockReset().mockResolvedValue(undefined)
    logSleep.mockReset().mockResolvedValue(undefined)
    updateSleepEntry.mockReset().mockResolvedValue(undefined)
    resumeSleep.mockReset().mockResolvedValue(undefined)
    updateSleepStart.mockReset().mockResolvedValue(undefined)
    updateSleepNotes.mockReset().mockResolvedValue(undefined)
    mockAuth()
    mockHousehold()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows an editable Start/End form with a Start Timer button and Save in the header when nothing is active', () => {
    mockActiveSleeps([])

    render(<SleepTimerModal onClose={vi.fn()} />)

    expect(screen.getByLabelText('Start Time')).toBeInTheDocument()
    expect(screen.getByLabelText('End Time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Timer' })).toHaveClass('button-timer-start')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('starts the timer and shows a starting placeholder until the active entry resolves', async () => {
    mockActiveSleeps([])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    expect(startSleep).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Starting…')).toBeInTheDocument()
    await vi.waitFor(() => expect(registerPush).toHaveBeenCalledWith('uid1'))
    expect(screen.getByRole('button', { name: 'Start Timer' })).toBeDisabled()
  })

  it('shows the live counter and a Stop Timer button once an entry is active', async () => {
    const activeEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    mockActiveSleeps([activeEntry])
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'Stop Timer' })).toHaveClass('button-timer-stop')
    await user.click(screen.getByRole('button', { name: 'Stop Timer' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T20:00:00.000Z'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('saves the notes typed while a timer is active, without stopping it', async () => {
    mockActiveSleeps([runningSleep])
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={onClose} />)
    await user.type(screen.getByLabelText('Notes (optional)'), 'nursed to sleep')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateSleepNotes).toHaveBeenCalledWith('h1', 'b1', 'sleep1', 'nursed to sleep')
    expect(stopSleep).not.toHaveBeenCalled()
    expect(logSleep).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the notes of the running sleep and writes nothing when they are left unchanged', async () => {
    mockActiveSleeps([{ ...runningSleep, notes: 'started on the other phone' }])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('started on the other phone')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateSleepNotes).not.toHaveBeenCalled()
  })

  it('starts the sleep with the notes typed before Start Timer', async () => {
    mockActiveSleeps([])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Notes (optional)'), 'in the stroller')
    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    expect(startSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1', expect.any(Date), 'in the stroller')
  })

  it('starts the timer at the tap, not when the modal opened', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-05T20:00:10+01:00'))
    mockActiveSleeps([])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    vi.setSystemTime(new Date('2026-03-05T20:05:42+01:00'))
    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    expect(startSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1', new Date('2026-03-05T20:05:42+01:00'), '')
    expect(dateTimeValue('Start Time')).toBe('2026-03-05T20:05')
  })

  it('starts the timer at an edited start time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-05T20:10:00+01:00'))
    mockActiveSleeps([])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    setDateTime('Start Time', '2026-03-05T19:45')
    vi.setSystemTime(new Date('2026-03-05T20:15:00+01:00'))
    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    expect(startSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1', new Date('2026-03-05T19:45:00+01:00'), '')
  })

  it('refuses an end time before the start time', async () => {
    mockActiveSleeps([])
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={onClose} />)
    setDateTime('Start Time', '2026-03-05T22:00')
    setDateTime('End Time', '2026-03-05T21:30')

    expect(screen.getByRole('alert')).toHaveTextContent('End time must be after start time.')
    expect(screen.queryByText(/^-/)).not.toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.click(save)
    expect(logSleep).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('reports a failed stop with the generic message, not the lock one', async () => {
    mockActiveSleeps([runningSleep])
    stopSleep.mockRejectedValue(new Error('network'))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Stop Timer' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save this sleep. Please try again.'))
  })

  it('reports a failed log of a past sleep', async () => {
    mockActiveSleeps([])
    logSleep.mockRejectedValue({ code: 'permission-denied' })
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    setDateTime('Start Time', '2026-03-05T20:00')
    setDateTime('End Time', '2026-03-05T21:30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save this sleep. Please try again.'))
  })

  it('announces when the timer starts or stops, never the running counter', () => {
    const setActive = mockActiveSleeps([])
    const { rerender } = render(<SleepTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('')

    setActive([runningSleep])
    rerender(<SleepTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Sleep timer started.')
    expect(screen.getByRole('status')).not.toHaveTextContent(/\d/)
    expect(document.querySelector('.modal-counter')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('[aria-live]')).toBeNull()

    setActive([])
    rerender(<SleepTimerModal onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Sleep timer stopped.')
  })

  it('does not announce a timer already running when the modal opens', () => {
    mockActiveSleeps([runningSleep])
    render(<SleepTimerModal onClose={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('saves a fixed past entry directly once an end time is entered, via the header Save', async () => {
    mockActiveSleeps([])
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={onClose} />)
    setDateTime('Start Time', '2026-03-05T20:00')
    setDateTime('End Time', '2026-03-05T21:30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logSleep).toHaveBeenCalledWith('h1', 'b1', 'uid1', {
      startedAt: new Date('2026-03-05T20:00:00+01:00'),
      endedAt: new Date('2026-03-05T21:30:00+01:00'),
      notes: '',
    })
    expect(startSleep).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('lets you correct a quick timer entry after it stops, saving an update instead of a duplicate', async () => {
    const activeEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const setActive = mockActiveSleeps([activeEntry])
    const onClose = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(<SleepTimerModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Stop Timer' }))

    expect(stopSleep).toHaveBeenCalledTimes(1)

    setActive([])
    rerender(<SleepTimerModal onClose={onClose} />)

    expect(screen.queryByRole('button', { name: 'Stop Timer' })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Hours'))
    await user.type(screen.getByLabelText('Hours'), '0')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const expectedStart = new Date(activeEntry.startedAt)
    const expectedEnd = new Date(expectedStart.getTime() + 5 * 60000)
    expect(updateSleepEntry).toHaveBeenCalledWith('h1', 'b1', 'sleep1', {
      startedAt: expectedStart,
      endedAt: expectedEnd,
      notes: '',
    })
    expect(logSleep).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('continues the same sleep when Start is pressed again after a stop', async () => {
    const activeEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const setActive = mockActiveSleeps([activeEntry])
    const user = userEvent.setup()

    const { rerender } = render(<SleepTimerModal onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Stop Timer' }))
    setActive([])
    rerender(<SleepTimerModal onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    expect(resumeSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date(activeEntry.startedAt), '')
    expect(startSleep).not.toHaveBeenCalled()
    expect(screen.getByText('Starting…')).toBeInTheDocument()

    setActive([activeEntry])
    rerender(<SleepTimerModal onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Stop Timer' })).toBeInTheDocument()
  })

  it('stops every sleep running when two were started at once', async () => {
    const first: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const second: SleepEntry = { ...first, id: 'sleep2', startedAt: '2026-03-05T20:03:00.000Z' }
    mockActiveSleeps([first, second])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Stop Timer' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date(first.startedAt))
    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep2', new Date(second.startedAt))
  })

  it('tells when the start is refused because another sleep runs, and lets Start be pressed again', async () => {
    mockActiveSleeps([])
    startSleep.mockRejectedValue(Object.assign(new Error('Missing permissions'), { code: 'permission-denied' }))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Start Timer' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Another sleep timer is already running.'))
    expect(screen.getByRole('button', { name: 'Start Timer' })).toBeEnabled()
  })

  it('moves the start of the running sleep when Start Time is changed', () => {
    const activeEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    mockActiveSleeps([activeEntry])

    render(<SleepTimerModal onClose={vi.fn()} />)
    expect(screen.getByLabelText('Start Time')).toBeEnabled()
    const hour = screen.getByLabelText('Start Time hour')
    fireEvent.change(hour, { target: { value: '2' } })
    fireEvent.change(hour, { target: { value: '20' } })
    // Nothing is written digit by digit: the counter does not jump while typing.
    expect(updateSleepStart).not.toHaveBeenCalled()
    expect(dateTimeValue('Start Time')).toBe('2026-03-05T20:00')

    fireEvent.focusOut(hour)

    expect(updateSleepStart).toHaveBeenCalledTimes(1)
    expect(updateSleepStart).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T20:00:00+01:00'))
  })

  it('writes an edited start of the running sleep on Save', async () => {
    mockActiveSleeps([runningSleep])
    const user = userEvent.setup()

    render(<SleepTimerModal onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Start Time minute'), { target: { value: '30' } })
    expect(updateSleepStart).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateSleepStart).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T21:30:00+01:00'))
  })

  it('never moves the start of the running sleep into the future', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-05T22:00:00+01:00'))
    try {
      const activeEntry: SleepEntry = {
        id: 'sleep1',
        startedAt: '2026-03-05T20:00:00.000Z',
        endedAt: null,
        durationSeconds: null,
        notes: '',
        createdBy: 'uid1',
        createdAt: '2026-03-05T20:00:00.000Z',
      }
      mockActiveSleeps([activeEntry])

      render(<SleepTimerModal onClose={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Start Time hour'), { target: { value: '23' } })
      fireEvent.focusOut(screen.getByLabelText('Start Time hour'))

      expect(updateSleepStart).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T22:00:00+01:00'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('clamps a future start time to now before the timer starts', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-05T22:00:00+01:00'))
    try {
      mockActiveSleeps([])

      render(<SleepTimerModal onClose={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Start Time hour'), { target: { value: '23' } })

      expect(dateTimeValue('Start Time')).toBe('2026-03-05T22:00')
      expect(screen.getByLabelText('Start Time')).toHaveAttribute('max', '2026-03-05')
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers the new day in the date picker once midnight passes with the modal open', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T23:59:50+01:00'))
    try {
      mockActiveSleeps([])

      render(<SleepTimerModal onClose={vi.fn()} />)
      expect(screen.getByLabelText('Start Time')).toHaveAttribute('max', '2026-03-05')

      act(() => {
        vi.advanceTimersByTime(30_000)
      })

      expect(screen.getByLabelText('Start Time')).toHaveAttribute('max', '2026-03-06')
    } finally {
      vi.useRealTimers()
    }
  })
})
