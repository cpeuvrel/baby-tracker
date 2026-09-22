import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { MedicationForm } from './MedicationForm'

const logMedication = vi.fn()

vi.mock('../repositories/medicationEntries', () => ({
  logMedication: (...args: unknown[]) => logMedication(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

function renderMedicationForm(onSaved = vi.fn()) {
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
  render(<MedicationForm onSaved={onSaved} />)
}

describe('MedicationForm', () => {
  beforeEach(() => {
    logMedication.mockReset()
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
})
