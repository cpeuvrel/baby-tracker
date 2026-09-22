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
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

const entry: MedicationEntry = {
  id: 'm1',
  name: 'Vitamine D',
  givenAt: '2026-03-05T09:00:00.000Z',
  dose: '2 gouttes',
  notes: 'note existante',
  createdBy: 'uid1',
  createdAt: '2026-03-05T09:00:00.000Z',
}

function renderMedicationForm(onSaved = vi.fn(), medicationEntry?: MedicationEntry) {
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
  render(<MedicationForm entry={medicationEntry} onSaved={onSaved} />)
}

describe('MedicationForm', () => {
  beforeEach(() => {
    logMedication.mockReset()
    updateMedicationEntry.mockReset()
    deleteMedicationEntry.mockReset()
  })

  it('defaults the medication name to Vitamine D and submits with the entered dose', async () => {
    const onSaved = vi.fn()
    const before = Date.now()
    const user = userEvent.setup()

    renderMedicationForm(onSaved)
    expect(screen.getByLabelText('Médicament')).toHaveValue('Vitamine D')
    await user.type(screen.getByLabelText('Dose (optionnel)'), '2 gouttes')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(logMedication).toHaveBeenCalledTimes(1)
    const [, , , input] = logMedication.mock.calls[0]
    expect(input).toMatchObject({ name: 'Vitamine D', dose: '2 gouttes', notes: '' })
    expect(input.givenAt).toBeInstanceOf(Date)
    expect(input.givenAt.getTime()).toBeGreaterThanOrEqual(before - 60_000)
    expect(onSaved).toHaveBeenCalled()
  })

  it('does not submit when the medication name is cleared', async () => {
    const user = userEvent.setup()

    renderMedicationForm()
    await user.clear(screen.getByLabelText('Médicament'))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(logMedication).not.toHaveBeenCalled()
  })

  it('prefills the form from an existing entry and updates it on save', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    renderMedicationForm(onSaved, entry)

    expect(screen.getByLabelText('Dose (optionnel)')).toHaveValue('2 gouttes')
    expect(screen.getByDisplayValue('note existante')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateMedicationEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'm1',
      expect.objectContaining({ name: 'Vitamine D', dose: '2 gouttes', notes: 'note existante' }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(logMedication).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderMedicationForm(onSaved, entry)
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(deleteMedicationEntry).toHaveBeenCalledWith('h1', 'b1', 'm1')
    expect(onSaved).toHaveBeenCalled()
  })
})
