import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddChildPage } from './AddChildPage'
import { mockHousehold } from '../test/mockContexts'

const addBaby = vi.fn()

vi.mock('../repositories/babies', () => ({
  addBaby: (...args: unknown[]) => addBaby(...args),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account/family/add']}>
      <Routes>
        <Route path="/account/family/add" element={<AddChildPage />} />
        <Route path="/account/family" element={<p>Children list</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AddChildPage', () => {
  beforeEach(() => {
    addBaby.mockReset()
    addBaby.mockResolvedValue(undefined)
    mockHousehold({ babies: [], selectedBaby: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing without a resolved household', () => {
    mockHousehold({ household: null, babies: [], selectedBaby: null })

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
    expect(await screen.findByText('Children list')).toBeInTheDocument()
  })

  async function fillForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('First Name'), 'Nina')
    await user.click(screen.getByRole('button', { name: 'Girl' }))
    await user.type(screen.getByLabelText('Birthdate'), '2026-01-15')
  }

  it('creates the child once on a double tap', async () => {
    let finish!: () => void
    addBaby.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    renderPage()
    await fillForm(user)

    await user.dblClick(screen.getByRole('button', { name: 'Save' }))

    expect(addBaby).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    finish()
    expect(await screen.findByText('Children list')).toBeInTheDocument()
  })

  it('stays on the form and says so when the child cannot be added', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    addBaby.mockRejectedValue(new Error('permission-denied'))
    const user = userEvent.setup()
    renderPage()
    await fillForm(user)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the child.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByLabelText('First Name')).toHaveValue('Nina')
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
