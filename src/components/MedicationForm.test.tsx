import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
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

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

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
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: { uid: 'uid1' } as User,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [baby],
    loading: false,
    selectedBaby: baby,
    selectBaby: vi.fn(),
  })
  render(<MedicationForm entry={medicationEntry} onClose={onClose} />)
}

describe('MedicationForm', () => {
  beforeEach(() => {
    logMedication.mockReset()
    updateMedicationEntry.mockReset()
    deleteMedicationEntry.mockReset()
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
})
