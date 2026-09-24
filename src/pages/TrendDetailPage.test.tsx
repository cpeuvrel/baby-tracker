import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, formatDate } from '../lib/appTime'
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

    await user.click(screen.getByRole('button', { name: 'Graph' }))
    expect(screen.getByLabelText('Metric graph')).toBeInTheDocument()
    expect(screen.getByText('AVG')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Entries' }))
    const dayHeading = formatDate(now, { month: 'short', day: 'numeric', year: 'numeric' })
    expect(screen.getByRole('heading', { name: dayHeading })).toBeInTheDocument()
    expect(screen.getByText('120 mL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bottle/ })).toBeInTheDocument()
  })

  it('draws counts as one block per entry', async () => {
    const user = userEvent.setup()
    const { container } = renderPage('feedSessions')

    await user.click(screen.getByRole('button', { name: 'Graph' }))
    expect(container.querySelectorAll('.metric-graph-block')).toHaveLength(1)
    expect(container.querySelector('.metric-graph-bar')).toBeNull()
  })

  it('opens the Entries view on the tapped day', async () => {
    const user = userEvent.setup()
    renderPage('feedSessions')
    await user.click(screen.getByRole('button', { name: 'Graph' }))

    const yesterday = addDays(now, -1)
    const columnLabel = formatDate(yesterday, { weekday: 'short', month: 'short', day: 'numeric' })
    await user.click(screen.getByRole('button', { name: `${columnLabel}: 0.0` }))

    expect(screen.getByRole('button', { name: 'Entries' })).toHaveAttribute('aria-pressed', 'true')
    const heading = screen.getByRole('heading', {
      name: formatDate(yesterday, { month: 'short', day: 'numeric', year: 'numeric' }),
    })
    expect(heading).toHaveClass('is-focused')
    expect(screen.getByText('No entries this day')).toBeInTheDocument()
    expect(screen.getByText('120 mL')).toBeInTheDocument()
  })

  it('selects a day from the date header', async () => {
    const user = userEvent.setup()
    const { container } = renderPage('feedSessions')
    await user.click(screen.getByRole('button', { name: 'Graph' }))

    const yesterday = addDays(now, -1)
    const label = formatDate(yesterday, { weekday: 'short', month: 'short', day: 'numeric' })
    const headerButton = screen.getByRole('button', { name: label })

    await user.click(headerButton)
    expect(headerButton).toHaveAttribute('aria-pressed', 'true')
    expect(headerButton).toHaveClass('is-selected')
    expect(container.querySelector('.metric-graph-legend')).toHaveTextContent(`${label}0.0`)

    await user.click(headerButton)
    expect(headerButton).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('.metric-graph-legend')).toHaveTextContent('Bottle')
  })

  it('pages to earlier periods but never past today', async () => {
    const user = userEvent.setup()
    renderPage('feedSessions')
    await user.click(screen.getByRole('button', { name: 'Graph' }))

    const todayLabel = formatDate(now, { weekday: 'short', month: 'short', day: 'numeric' })
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()
    expect(screen.getByRole('button', { name: todayLabel })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.queryByRole('button', { name: todayLabel })).toBeNull()
    const twoWeeksAgo = addDays(now, -14)
    expect(
      screen.getByRole('button', {
        name: formatDate(twoWeeksAgo, { weekday: 'short', month: 'short', day: 'numeric' }),
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next period' }))
    expect(screen.getByRole('button', { name: todayLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()
  })

  it('draws quantities as bars', async () => {
    const user = userEvent.setup()
    const { container } = renderPage('feedVolume')

    await user.click(screen.getByRole('button', { name: 'Graph' }))
    expect(container.querySelectorAll('.metric-graph-bar')).toHaveLength(1)
    expect(container.querySelector('.metric-graph-block')).toBeNull()
  })

  it('changes the period from the header select', async () => {
    const user = userEvent.setup()
    renderPage('feedSessions')

    await user.selectOptions(screen.getByLabelText('Period'), '7')

    expect(screen.getByLabelText('Period')).toHaveValue('7')
  })
})
