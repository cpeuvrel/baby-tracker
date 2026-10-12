import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import * as useRecentSleepEntriesModule from '../hooks/useRecentSleepEntries'
import { mockHousehold } from '../test/mockContexts'
import type { SleepEntry } from '../types/models'
import { SleepEntryEditModal } from './SleepEntryEditModal'
import { dateTimeValue, setDateTime } from '../test/timeFields'

const updateSleepEntry = vi.fn().mockResolvedValue(undefined)
const deleteSleepEntry = vi.fn().mockResolvedValue(undefined)
const resumeSleep = vi.fn().mockResolvedValue(undefined)

vi.mock('../repositories/sleepEntries', () => ({
  updateSleepEntry: (...args: unknown[]) => updateSleepEntry(...args),
  deleteSleepEntry: (...args: unknown[]) => deleteSleepEntry(...args),
  resumeSleep: (...args: unknown[]) => resumeSleep(...args),
}))

const entry: SleepEntry = {
  id: 's1',
  startedAt: '2026-03-05T20:00:00+01:00',
  endedAt: '2026-03-05T21:30:00+01:00',
  durationSeconds: 5400,
  notes: 'nap',
  createdBy: 'uid1',
  createdAt: '2026-03-05T20:00:00+01:00',
}

describe('SleepEntryEditModal', () => {
  beforeEach(() => {
    updateSleepEntry.mockReset().mockResolvedValue(undefined)
    deleteSleepEntry.mockReset().mockResolvedValue(undefined)
    resumeSleep.mockReset().mockResolvedValue(undefined)
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue(null)
    vi.spyOn(useRecentSleepEntriesModule, 'useRecentSleepEntries').mockReturnValue([entry])
    mockHousehold()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prefills the total time from the existing entry', () => {
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.getByLabelText('Hours')).toHaveValue(1)
    expect(screen.getByLabelText('Minutes')).toHaveValue(30)
  })

  it('adapts the end time when the duration is edited, keeping the start time fixed', async () => {
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    await user.clear(screen.getByLabelText('Hours'))
    await user.type(screen.getByLabelText('Hours'), '0')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '45')

    expect(dateTimeValue('Start Time')).toBe('2026-03-05T20:00')
    expect(dateTimeValue('End Time')).toBe('2026-03-05T20:45')
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('saves the edited start/end times and notes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={onClose} />)

    await user.clear(screen.getByLabelText('Hours'))
    await user.type(screen.getByLabelText('Hours'), '0')
    await user.clear(screen.getByLabelText('Minutes'))
    await user.type(screen.getByLabelText('Minutes'), '45')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateSleepEntry).toHaveBeenCalledWith('h1', 'b1', 's1', {
      startedAt: new Date('2026-03-05T20:00:00+01:00'),
      endedAt: new Date('2026-03-05T20:45:00+01:00'),
      notes: 'nap',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SleepEntryEditModal entry={entry} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteSleepEntry).toHaveBeenCalledWith('h1', 'b1', 's1')
    expect(onClose).toHaveBeenCalled()
  })

  it('does not delete when the confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteSleepEntry).not.toHaveBeenCalled()
  })

  it('refuses to save an old sleep without an end, which would restart it', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Set an end time to save this sleep.')
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.click(save)
    expect(updateSleepEntry).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('refuses an end before the start', async () => {
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    setDateTime('End Time', '2026-03-05T19:30')

    expect(screen.getByRole('alert')).toHaveTextContent('End time must be after start time.')
    expect(screen.queryByText(/^-/)).not.toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.click(save)
    expect(updateSleepEntry).not.toHaveBeenCalled()
  })

  it('reports a failed save with the generic message when the end is set (no lock involved)', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateSleepEntry.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save this sleep. Please try again.'))
    expect(alert).not.toHaveBeenCalledWith('Another sleep timer is already running.')
  })

  it('reports a refused delete', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteSleepEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete the sleep. Please try again.'))
  })

  describe('Start Timer', () => {
    beforeEach(() => {
      // 10 minutes after the entry ended (21:30 Paris).
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-05T21:40:00+01:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('continues the latest stopped sleep from its start time and hands over to the running timer', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onResumed = vi.fn()
      render(<SleepEntryEditModal entry={entry} onClose={onClose} onResumed={onResumed} />)

      await user.click(screen.getByRole('button', { name: 'Start Timer' }))

      expect(resumeSleep).toHaveBeenCalledWith('h1', 'b1', 's1', new Date(entry.startedAt), 'nap')
      await vi.waitFor(() => expect(onResumed).toHaveBeenCalled())
      expect(onClose).not.toHaveBeenCalled()
    })

    it('keeps notes edited just before Start Timer', async () => {
      const user = userEvent.setup()
      render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} onResumed={vi.fn()} />)

      await user.clear(screen.getByLabelText('Notes (optional)'))
      await user.type(screen.getByLabelText('Notes (optional)'), 'fell back asleep')
      await user.click(screen.getByRole('button', { name: 'Start Timer' }))

      expect(resumeSleep).toHaveBeenCalledWith('h1', 'b1', 's1', new Date(entry.startedAt), 'fell back asleep')
    })

    it('stays open and says why when the resume is refused', async () => {
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
      resumeSleep.mockRejectedValue({ code: 'permission-denied' })
      const user = userEvent.setup()
      const onResumed = vi.fn()
      render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} onResumed={onResumed} />)

      await user.click(screen.getByRole('button', { name: 'Start Timer' }))

      await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Another sleep timer is already running.'))
      expect(onResumed).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Start Timer' })).toBeEnabled()
    })

    it('resumes the sleep on Save when the end is cleared within the hour', async () => {
      const user = userEvent.setup()
      render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

      fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '' } })
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(updateSleepEntry).toHaveBeenCalledWith('h1', 'b1', 's1', expect.objectContaining({ endedAt: null }))
    })

    it('just closes when there is no running-timer view to hand over to', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<SleepEntryEditModal entry={entry} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'Start Timer' }))

      expect(resumeSleep).toHaveBeenCalled()
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('is not offered once the sleep ended more than an hour ago', () => {
      vi.setSystemTime(new Date('2026-03-05T22:31:00+01:00'))
      render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Start Timer' })).not.toBeInTheDocument()
    })

    it('is not offered for an older sleep', () => {
      vi.spyOn(useRecentSleepEntriesModule, 'useRecentSleepEntries').mockReturnValue([{ ...entry, id: 'newer' }])
      render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Start Timer' })).not.toBeInTheDocument()
    })

    it('is not offered while another sleep is running', () => {
      vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntry').mockReturnValue({
        ...entry,
        id: 'running',
        endedAt: null,
        durationSeconds: null,
      })
      render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Start Timer' })).not.toBeInTheDocument()
    })
  })
})
