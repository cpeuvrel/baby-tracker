import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import type { FeedingEntry } from '../types/models'
import { TrendDetailPage } from './TrendDetailPage'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

const now = new Date()

const feeding: FeedingEntry[] = [
  {
    id: 'f1',
    type: 'bottle',
    occurredAt: now.toISOString(),
    volumeMl: 120,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: now.toISOString(),
  },
]

function renderPage(metricId = 'feedSessions') {
  return render(
    <MemoryRouter initialEntries={[`/trends/${metricId}`]}>
      <Routes>
        <Route path="/trends" element={<p>Trends list</p>} />
        <Route path="/trends/:metricId" element={<TrendDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TrendDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding,
      sleep: [],
      diaper: [],
      medication: [],
    })
  })

  it('renders nothing for an unknown metric id', () => {
    const { container } = renderPage('not-a-metric')

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the metric title and headline', () => {
    renderPage('feedSessions')

    expect(screen.getByRole('heading', { name: 'Bottles' })).toBeInTheDocument()
    expect(screen.getByText(/bottles \/ day/)).toBeInTheDocument()
  })

  it('navigates back to the trends list', async () => {
    const user = userEvent.setup()
    renderPage('feedSessions')

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Trends list')).toBeInTheDocument()
  })

  it('switches between calendar, graph and entries views', async () => {
    const user = userEvent.setup()
    renderPage('feedSessions')

    expect(screen.getByLabelText('Metric calendar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Entries' }))
    expect(screen.getByText(/Bottle 120 mL/)).toBeInTheDocument()
  })
})
