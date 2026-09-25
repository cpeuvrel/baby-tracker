import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { ChildPage } from './ChildPage'

const updateBaby = vi.fn()
const exportBabyData = vi.fn()

vi.mock('../repositories/babies', () => ({
  updateBaby: (...args: unknown[]) => updateBaby(...args),
  updateBabyPhoto: vi.fn(),
}))

vi.mock('../lib/babyExport', () => ({
  exportBabyData: (...args: unknown[]) => exportBabyData(...args),
  importBabyData: vi.fn(),
  parseImportFile: vi.fn(),
  serializeBabyExport: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'uid1' },
    loading: false,
    error: null,
    devLoginAvailable: false,
    loginWithGoogle: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
  }),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

function renderPage(babyId = 'b1') {
  return render(
    <MemoryRouter initialEntries={[`/account/family/${babyId}`]}>
      <Routes>
        <Route path="/account/family/:babyId" element={<ChildPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ChildPage', () => {
  beforeEach(() => {
    updateBaby.mockReset()
    localStorage.clear()
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

  it('pre-fills the profile form with the baby and shows its computed age', () => {
    renderPage()

    expect(screen.getByLabelText('First Name')).toHaveValue('Léo')
    expect(screen.getByLabelText('Birthdate')).toHaveValue('2025-06-01')
    expect(screen.getByText('Age')).toBeInTheDocument()
  })

  it('has no "Use Adjusted Age" control and no Notes & Photos section', () => {
    renderPage()

    expect(screen.queryByText(/Adjusted Age/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Notes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Photos/)).not.toBeInTheDocument()
  })

  it('saves the edited profile', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.clear(screen.getByLabelText('First Name'))
    await user.type(screen.getByLabelText('First Name'), 'Léo Martin')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateBaby).toHaveBeenCalledWith('h1', 'b1', 'Léo Martin', '2025-06-01', null)
  })

  it('links to the Edit Activities screen for this baby', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /Edit Activities/ })).toHaveAttribute(
      'href',
      '/account/family/b1/activities',
    )
  })

  it('offers Export Data for this baby', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Export Data (CSV)' })).toBeInTheDocument()
  })

  it('links to Nighttime Hours, defaulting to 20:00 - 08:00', () => {
    renderPage()

    const link = screen.getByRole('link', { name: /Nighttime Hours/ })
    expect(link).toHaveAttribute('href', '/account/family/b1/nighttime-hours')
    expect(link).toHaveTextContent('20:00 - 08:00')
  })

  it('shows a customized Nighttime Hours range', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [{ ...baby, nighttimeHours: { start: '21:00', end: '06:30' } }],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    renderPage()

    expect(screen.getByRole('link', { name: /Nighttime Hours/ })).toHaveTextContent(
      '21:00 - 06:30',
    )
  })

  it('has no Unit toggle', () => {
    renderPage()

    expect(screen.queryByRole('group', { name: 'Unit' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Imperial/)).not.toBeInTheDocument()
  })
})
