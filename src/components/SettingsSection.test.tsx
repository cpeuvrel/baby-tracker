import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { SettingsSection } from './SettingsSection'

const updateBaby = vi.fn()

vi.mock('../repositories/babies', () => ({
  updateBaby: (...args: unknown[]) => updateBaby(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('SettingsSection', () => {
  beforeEach(() => {
    updateBaby.mockReset()
    localStorage.clear()
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('renders nothing without a resolved household and baby', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = render(<SettingsSection />)

    expect(container).toBeEmptyDOMElement()
  })

  it('pre-fills the profile form with the selected baby', () => {
    render(<SettingsSection />)

    expect(screen.getByLabelText("Baby's first name")).toHaveValue('Léo')
    expect(screen.getByLabelText('Date of birth')).toHaveValue('2025-06-01')
  })

  it('saves the edited profile', async () => {
    const user = userEvent.setup()

    render(<SettingsSection />)
    await user.clear(screen.getByLabelText("Baby's first name"))
    await user.type(screen.getByLabelText("Baby's first name"), 'Léo Martin')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(updateBaby).toHaveBeenCalledWith('h1', 'b1', 'Léo Martin', '2025-06-01', null)
  })

  it('sets the sex used to pick the right WHO percentile curves', async () => {
    const user = userEvent.setup()

    render(<SettingsSection />)
    await user.click(screen.getByRole('button', { name: 'Girl' }))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(updateBaby).toHaveBeenCalledWith('h1', 'b1', 'Léo', '2025-06-01', 'female')
  })

  it('defaults to the metric unit and switches to imperial on click', async () => {
    const user = userEvent.setup()

    render(<SettingsSection />)
    expect(screen.getByRole('button', { name: 'Metric (kg/cm)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Imperial (lb/in)' }))

    expect(screen.getByRole('button', { name: 'Imperial (lb/in)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(localStorage.getItem('baby-tracker:unitSystem')).toBe('imperial')
  })
})
