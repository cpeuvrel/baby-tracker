import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { NighttimeHoursPage } from './NighttimeHoursPage'

const updateNighttimeHours = vi.fn()

vi.mock('../repositories/babies', () => ({
  updateNighttimeHours: (...args: unknown[]) => updateNighttimeHours(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null, nighttimeHours: null }

function renderPage(babyId = 'b1') {
  return render(
    <MemoryRouter initialEntries={[`/account/family/${babyId}/nighttime-hours`]}>
      <Routes>
        <Route path="/account/family/:babyId/nighttime-hours" element={<NighttimeHoursPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NighttimeHoursPage', () => {
  beforeEach(() => {
    updateNighttimeHours.mockReset()
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('renders nothing when the baby cannot be found', () => {
    const { container } = renderPage('unknown')

    expect(container).toBeEmptyDOMElement()
  })

  it('defaults to 20:00–08:00 when the baby has no setting yet', () => {
    renderPage()

    expect(screen.getByLabelText('From')).toHaveValue('20:00')
    expect(screen.getByLabelText('To')).toHaveValue('08:00')
  })

  it('pre-fills with the baby\'s existing setting', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [{ ...baby, nighttimeHours: { start: '21:00', end: '06:30' } }],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    renderPage()

    expect(screen.getByLabelText('From')).toHaveValue('21:00')
    expect(screen.getByLabelText('To')).toHaveValue('06:30')
  })

  it('saves the edited range', async () => {
    updateNighttimeHours.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.clear(screen.getByLabelText('From'))
    await user.type(screen.getByLabelText('From'), '21:30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateNighttimeHours).toHaveBeenCalledWith('h1', 'b1', { start: '21:30', end: '08:00' })
  })
})
