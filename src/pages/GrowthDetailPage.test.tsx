import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useGrowthEntriesModule from '../hooks/useGrowthEntries'
import type { GrowthEntry } from '../types/models'
import { GrowthDetailPage } from './GrowthDetailPage'

vi.mock('../repositories/growthEntries', () => ({
  addGrowthEntry: vi.fn(),
  updateGrowthEntry: vi.fn(),
  deleteGrowthEntry: vi.fn(),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const babyGirl = { id: 'b1', name: 'Léo', birthDate: '2026-03-01', sex: 'female' as const }
const babyNoSex = { id: 'b1', name: 'Léo', birthDate: '2026-03-01', sex: null }

const entries: GrowthEntry[] = [
  {
    id: 'g1',
    measuredAt: '2026-04-05T09:00:00.000Z',
    weightG: 5200,
    heightMm: 580,
    headCircumferenceMm: 390,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-04-05T09:00:00.000Z',
  },
  {
    id: 'g2',
    measuredAt: '2026-05-05T09:00:00.000Z',
    weightG: 6480,
    heightMm: 610,
    headCircumferenceMm: 400,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-05-05T09:00:00.000Z',
  },
]

function renderPage(metric = 'weight') {
  return render(
    <MemoryRouter initialEntries={[`/growth/${metric}`]}>
      <Routes>
        <Route path="/" element={<p>Activity page</p>} />
        <Route path="/growth/:metric" element={<GrowthDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GrowthDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [babyGirl],
      loading: false,
      error: null,
      selectedBaby: babyGirl,
      selectBaby: vi.fn(),
    })
    vi.spyOn(useGrowthEntriesModule, 'useGrowthEntries').mockReturnValue(entries)
  })

  it('renders nothing for an unknown metric', () => {
    const { container } = renderPage('not-a-metric')

    expect(container).toBeEmptyDOMElement()
  })

  it('shows only the chart in chart view, no data card below it', () => {
    renderPage('weight')

    expect(screen.getByRole('button', { name: 'Weight', pressed: true })).toBeInTheDocument()
    expect(screen.queryByText(/Girls Percentile/)).not.toBeInTheDocument()
    expect(screen.queryByText('Source: WHO')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('navigates back to the activity page', async () => {
    const user = userEvent.setup()
    renderPage('weight')

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Activity page')).toBeInTheDocument()
  })

  it('switches metric tabs', async () => {
    const user = userEvent.setup()
    renderPage('weight')

    await user.click(screen.getByRole('button', { name: 'Height' }))
    await user.click(screen.getByRole('button', { name: 'Show list' }))

    expect(screen.getByText('61.0 cm')).toBeInTheDocument()
  })

  it('switches to the list view showing all entries grouped by date, with the metric, percentile and age on separate lines', async () => {
    const user = userEvent.setup()
    renderPage('weight')

    await user.click(screen.getByRole('button', { name: 'Show list' }))

    expect(screen.getByText('6.48 kg')).toBeInTheDocument()
    expect(screen.getByText('5.20 kg')).toBeInTheDocument()
    expect(screen.getAllByText(/Girls Percentile/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Age/).length).toBeGreaterThan(0)
  })

  it('opens the growth form to edit an entry from the list view', async () => {
    const user = userEvent.setup()
    renderPage('weight')

    await user.click(screen.getByRole('button', { name: 'Show list' }))
    await user.click(screen.getByRole('button', { name: /6.48 kg/ }))

    expect(screen.getByRole('dialog', { name: 'Growth' })).toBeInTheDocument()
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.48)
  })

  it('prompts to set the sex in settings when unknown, and still allows the list view', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [babyNoSex],
      loading: false,
      error: null,
      selectedBaby: babyNoSex,
      selectBaby: vi.fn(),
    })

    renderPage('weight')

    expect(screen.getByText(/Set the baby's sex in Settings/)).toBeInTheDocument()
  })
})
