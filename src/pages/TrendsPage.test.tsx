import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import * as useGrowthEntriesModule from '../hooks/useGrowthEntries'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { TrendsPage } from './TrendsPage'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

const now = new Date()

const sleep: SleepEntry[] = [
  {
    id: 's1',
    startedAt: now.toISOString(),
    endedAt: new Date(now.getTime() + 3600_000).toISOString(),
    durationSeconds: 3600,
    notes: '',
    createdBy: 'uid1',
    createdAt: now.toISOString(),
  },
]
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
const diaper: DiaperEntry[] = [
  {
    id: 'd1',
    type: 'wet',
    occurredAt: now.toISOString(),
    notes: '',
    createdBy: 'uid1',
    createdAt: now.toISOString(),
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <TrendsPage />
    </MemoryRouter>,
  )
}

describe('TrendsPage', () => {
  beforeEach(() => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({ feeding, sleep, diaper, medication: [] })
    vi.spyOn(useGrowthEntriesModule, 'useGrowthEntries').mockReturnValue([])
  })

  it('renders nothing without a resolved household and baby', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      error: null,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a row per metric, grouped by section, linking to its detail page', () => {
    renderPage()

    const feedRow = screen.getByRole('link', { name: /Bottles/ })
    expect(feedRow).toHaveAttribute('href', '/trends/feedSessions')

    const sleepRow = screen.getByRole('link', { name: /Total sleep/ })
    expect(sleepRow).toHaveAttribute('href', '/trends/sleepTotal')

    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Diaper' })).toBeInTheDocument()
  })

  it('switches range and re-queries entries for the new period', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '14d' }))

    expect(useEntriesInRangeModule.useEntriesInRange).toHaveBeenLastCalledWith(
      'h1',
      'b1',
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    )
  })

  it('also renders the growth section', () => {
    renderPage()

    expect(screen.getByRole('region', { name: 'Growth chart' })).toBeInTheDocument()
  })
})
