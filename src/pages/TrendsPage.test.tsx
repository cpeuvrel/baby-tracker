import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import { mockHousehold } from '../test/mockContexts'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { dayKey } from '../lib/timeline'
import { TrendsPage } from './TrendsPage'

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
    mockHousehold()
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({ feeding, sleep, diaper, medication: [], bath: [] })
  })

  it('renders nothing without a resolved household and baby', () => {
    mockHousehold({ household: null, babies: [], selectedBaby: null })

    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a row per metric, grouped by section, linking to its detail page', () => {
    renderPage()

    const feedRow = screen.getByRole('link', { name: /Feed Sessions/ })
    expect(feedRow).toHaveAttribute('href', '/trends/feedSessions?days=7')

    const sleepRow = screen.getByRole('link', { name: /Total Sleep/ })
    expect(sleepRow).toHaveAttribute('href', '/trends/sleepTotal?days=7')

    expect(screen.getByRole('heading', { name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Diaper' })).toBeInTheDocument()
  })

  it('links Longest Sleep to the day of the period\'s longest sleep', () => {
    const wokeUp = new Date(now.getTime() - 3600_000)
    const night: SleepEntry = {
      ...sleep[0],
      id: 'night',
      startedAt: new Date(wokeUp.getTime() - 11 * 3600_000).toISOString(),
      endedAt: wokeUp.toISOString(),
      durationSeconds: 11 * 3600,
    }
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding,
      sleep: [night],
      diaper,
      medication: [],
      bath: [],
    })

    renderPage()

    const row = screen.getByRole('link', { name: /Longest Sleep/ })
    expect(row).toHaveAttribute('href', `/trends/sleepLongest?days=7&day=${dayKey(wokeUp)}`)
    expect(row).toHaveTextContent('longest')
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

  it('opens the detail on the period shown', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '14d' }))

    expect(screen.getByRole('link', { name: /Feed Sessions/ })).toHaveAttribute('href', '/trends/feedSessions?days=14')
  })

  it('does not render the growth section', () => {
    renderPage()

    expect(screen.queryByRole('region', { name: 'Growth chart' })).not.toBeInTheDocument()
  })
})
