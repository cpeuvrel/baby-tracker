import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import type { SleepEntry } from '../types/models'
import { SleepEntryEditModal } from './SleepEntryEditModal'

const updateSleepEntry = vi.fn()
const deleteSleepEntry = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  updateSleepEntry: (...args: unknown[]) => updateSleepEntry(...args),
  deleteSleepEntry: (...args: unknown[]) => deleteSleepEntry(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

const entry: SleepEntry = {
  id: 's1',
  startedAt: '2026-03-05T20:00:00',
  endedAt: '2026-03-05T21:30:00',
  durationSeconds: 5400,
  notes: 'sieste',
  createdBy: 'uid1',
  createdAt: '2026-03-05T20:00:00',
}

describe('SleepEntryEditModal', () => {
  beforeEach(() => {
    updateSleepEntry.mockReset()
    deleteSleepEntry.mockReset()
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('prefills the total time from the existing entry', () => {
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    expect(screen.getByText('1h 30min')).toBeInTheDocument()
    expect(screen.getByLabelText('Durée (minutes)')).toHaveValue(90)
  })

  it('adapts the end time when the duration is edited, keeping the start time fixed', async () => {
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)

    const durationInput = screen.getByLabelText('Durée (minutes)')
    await user.clear(durationInput)
    await user.type(durationInput, '45')

    expect(screen.getByLabelText('Start Time')).toHaveValue('2026-03-05T20:00')
    expect(screen.getByLabelText('End Time')).toHaveValue('2026-03-05T20:45')
    expect(screen.getByText('45min 00s')).toBeInTheDocument()
  })

  it('saves the edited start/end times and notes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SleepEntryEditModal entry={entry} onClose={onClose} />)

    const durationInput = screen.getByLabelText('Durée (minutes)')
    await user.clear(durationInput)
    await user.type(durationInput, '45')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateSleepEntry).toHaveBeenCalledWith('h1', 'b1', 's1', {
      startedAt: new Date('2026-03-05T20:00:00'),
      endedAt: new Date('2026-03-05T20:45:00'),
      notes: 'sieste',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SleepEntryEditModal entry={entry} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(deleteSleepEntry).toHaveBeenCalledWith('h1', 'b1', 's1')
    expect(onClose).toHaveBeenCalled()
  })

  it('does not delete when the confirmation is dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<SleepEntryEditModal entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(deleteSleepEntry).not.toHaveBeenCalled()
  })
})
