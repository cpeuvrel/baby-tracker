import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { MedicationEntry } from '../types/models'
import { MedicationForm } from './MedicationForm'

const logMedication = vi.fn()
const updateMedicationEntry = vi.fn()
const deleteMedicationEntry = vi.fn()

vi.mock('../repositories/medicationEntries', () => ({
  logMedication: (...args: unknown[]) => logMedication(...args),
  updateMedicationEntry: (...args: unknown[]) => updateMedicationEntry(...args),
  deleteMedicationEntry: (...args: unknown[]) => deleteMedicationEntry(...args),
}))

const entry: MedicationEntry = {
  id: 'm1',
  name: 'Vitamin D',
  givenAt: '2026-03-05T09:00:00.000Z',
  dose: '2 drops',
  notes: 'existing note',
  createdBy: 'uid1',
  createdAt: '2026-03-05T09:00:00.000Z',
}

function renderMedicationForm(onClose = vi.fn(), medicationEntry?: MedicationEntry) {
  mockAuth()
  mockHousehold()
  render(<MedicationForm entry={medicationEntry} onClose={onClose} />)
}

describe('MedicationForm', () => {
  beforeEach(() => {
    logMedication.mockReset().mockResolvedValue(undefined)
    updateMedicationEntry.mockReset().mockResolvedValue(undefined)
    deleteMedicationEntry.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults the medication name to Vitamin D and submits with the entered dose', async () => {
    const onClose = vi.fn()
    const before = Date.now()
    const user = userEvent.setup()

    renderMedicationForm(onClose)
    expect(screen.getByRole('textbox', { name: 'Medication' })).toHaveValue('Vitamin D')
    await user.type(screen.getByLabelText('Dose (optional)'), '2 drops')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logMedication).toHaveBeenCalledTimes(1)
    const [, , , input] = logMedication.mock.calls[0]
    expect(input).toMatchObject({ name: 'Vitamin D', dose: '2 drops', notes: '' })
    expect(input.givenAt).toBeInstanceOf(Date)
    expect(input.givenAt.getTime()).toBeGreaterThanOrEqual(before - 60_000)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not submit when the medication name is cleared', async () => {
    const user = userEvent.setup()

    renderMedicationForm()
    await user.clear(screen.getByRole('textbox', { name: 'Medication' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logMedication).not.toHaveBeenCalled()
  })

  it('prefills the form from an existing entry and updates it on save', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderMedicationForm(onClose, entry)

    expect(screen.getByLabelText('Dose (optional)')).toHaveValue('2 drops')
    expect(screen.getByDisplayValue('existing note')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateMedicationEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'm1',
      expect.objectContaining({ name: 'Vitamin D', dose: '2 drops', notes: 'existing note' }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(logMedication).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderMedicationForm(onClose, entry)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteMedicationEntry).toHaveBeenCalledWith('h1', 'b1', 'm1')
    expect(onClose).toHaveBeenCalled()
  })

  it('tells the user when the save is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateMedicationEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    renderMedicationForm(vi.fn(), entry)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save the dose. Please try again.'))
  })

  it('tells the user when the delete is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteMedicationEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    renderMedicationForm(vi.fn(), entry)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete the dose. Please try again.'))
  })

  it('refuses to save without a date', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderMedicationForm(onClose)

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logMedication).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date.')
  })
})
