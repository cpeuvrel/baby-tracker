import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { zonedTime } from '../lib/appTime'
import type { FeedingEntry, SleepEntry } from '../types/models'
import { TrendEntriesList } from './TrendEntriesList'

function bottle(id: string, occurredAt: string, volumeMl: number | null): FeedingEntry {
  return {
    id,
    type: 'bottle',
    occurredAt,
    volumeMl,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: occurredAt,
  }
}

describe('TrendEntriesList', () => {
  const entries = [
    bottle('a', zonedTime(2026, 9, 22, 8, 33).toISOString(), 40),
    bottle('b', zonedTime(2026, 9, 23, 14, 0).toISOString(), 240),
    bottle('c', zonedTime(2026, 9, 23, 18, 58).toISOString(), 110),
  ]

  it('groups entries by day, newest first, with time and volume', () => {
    render(<TrendEntriesList kind="feeding" colorVar="--category-feeding" entries={entries} onSelect={vi.fn()} />)

    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings).toEqual(['Sep 23, 2026', 'Sep 22, 2026'])

    const day23 = screen.getByRole('region', { name: 'Sep 23, 2026' })
    const rows = within(day23).getAllByRole('button')
    expect(rows[0]).toHaveTextContent('18:58 Bottle110 mL')
    expect(rows[1]).toHaveTextContent('14:00 Bottle240 mL')
  })

  it('opens the selected entry', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<TrendEntriesList kind="feeding" colorVar="--category-feeding" entries={entries} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /08:33/ }))

    expect(onSelect).toHaveBeenCalledWith(entries[0])
  })

  it('shows the real length of a finished sleep without a recorded duration', () => {
    const sleep: SleepEntry = {
      id: 's1',
      startedAt: zonedTime(2026, 9, 23, 13, 0).toISOString(),
      endedAt: zonedTime(2026, 9, 23, 14, 30).toISOString(),
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: zonedTime(2026, 9, 23, 13, 0).toISOString(),
    }
    render(<TrendEntriesList kind="sleep" colorVar="--category-sleep" entries={[sleep]} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: /13:00/ })).toHaveTextContent('1h 30m')
  })

  it('shows an empty state', () => {
    render(<TrendEntriesList kind="diaper" colorVar="--category-diaper" entries={[]} onSelect={vi.fn()} />)

    expect(screen.getByText('No entries for this period')).toBeInTheDocument()
  })
})
