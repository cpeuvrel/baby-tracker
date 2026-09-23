import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { AddChildPage } from './AddChildPage'

const addBaby = vi.fn()

vi.mock('../repositories/babies', () => ({
  addBaby: (...args: unknown[]) => addBaby(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }

function renderPage() {
  return render(
    <MemoryRouter>
      <AddChildPage />
    </MemoryRouter>,
  )
}

describe('AddChildPage', () => {
  beforeEach(() => {
    addBaby.mockReset()
    addBaby.mockResolvedValue(undefined)
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })
  })

  it('renders nothing without a resolved household', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })

  it('has no "Use Adjusted Age" control', () => {
    renderPage()

    expect(screen.queryByText(/Adjusted Age/)).not.toBeInTheDocument()
  })

  it('creates a new baby with the entered name, sex and birth date', async () => {
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('First Name'), 'Nina')
    await user.click(screen.getByRole('button', { name: 'Girl' }))
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addBaby).toHaveBeenCalledWith('h1', 'Nina', '2026-01-15', 'female')
  })

  it('does not submit without a sex selected', async () => {
    const user = userEvent.setup()

    renderPage()
    await user.type(screen.getByLabelText('First Name'), 'Nina')
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addBaby).not.toHaveBeenCalled()
  })
})
