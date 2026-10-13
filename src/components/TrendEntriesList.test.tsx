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

function sleepEntry(id: string, startedAt: Date, endedAt: Date | null): SleepEntry {
  return {
    id,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    durationSeconds: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: startedAt.toISOString(),
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

  describe('sleep entries', () => {
    const twoHours = sleepEntry('long', zonedTime(2026, 9, 23, 13, 0), zonedTime(2026, 9, 23, 15, 0))
    const oneHour = sleepEntry('short', zonedTime(2026, 9, 23, 9, 0), zonedTime(2026, 9, 23, 10, 0))
    const running = sleepEntry('running', zonedTime(2026, 9, 23, 20, 15), null)

    function renderSleep(sleeps: SleepEntry[]) {
      return render(<TrendEntriesList kind="sleep" colorVar="--category-sleep" entries={sleeps} onSelect={vi.fn()} />)
    }

    it('shows a sleep in progress as "Sleeping / In progress", without a bar', () => {
      const { container } = renderSleep([running])

      const row = screen.getByRole('button', { name: /20:15/ })
      expect(row).toHaveTextContent('20:15 Sleeping')
      expect(row).toHaveTextContent('In progress')
      expect(container.querySelector('.trend-entry-bar')).toBeNull()
    })

    it('scales the bar of a finished sleep to the longest one', () => {
      const { container } = renderSleep([oneHour, twoHours, running])

      const bars = Array.from(container.querySelectorAll<HTMLElement>('.trend-entry-bar'))
      // Newest first: the 2 h sleep (full bar, 70 % of the row) then the 1 h sleep (half of it).
      expect(bars.map((bar) => bar.style.width)).toEqual(['70%', '35%'])
      expect(screen.getByRole('button', { name: /13:00/ })).toHaveTextContent('– 15:002h')
      expect(screen.getByRole('button', { name: /09:00/ })).toHaveTextContent('– 10:001h')
    })

    it('keeps a minimal bar for a very short sleep', () => {
      const nap = sleepEntry('nap', zonedTime(2026, 9, 23, 11, 0), zonedTime(2026, 9, 23, 11, 5))
      const { container } = renderSleep([twoHours, nap])

      const bars = Array.from(container.querySelectorAll<HTMLElement>('.trend-entry-bar'))
      expect(bars.map((bar) => bar.style.width)).toEqual(['70%', `${0.08 * 70}%`])
    })

    it('lists a sleep under the day given by dayKeyOf (sleep days start at night)', () => {
      const night = sleepEntry('night', zonedTime(2026, 9, 24, 1, 0), zonedTime(2026, 9, 24, 6, 0))
      render(
        <TrendEntriesList
          kind="sleep"
          colorVar="--category-sleep"
          entries={[night]}
          onSelect={vi.fn()}
          dayKeyOf={() => '2026-09-23'}
        />,
      )

      const day23 = screen.getByRole('region', { name: 'Sep 23, 2026' })
      expect(within(day23).getByRole('button', { name: /01:00/ })).toBeInTheDocument()
    })
  })

  describe('focused day', () => {
    const first = bottle('a', zonedTime(2026, 9, 21, 8, 0).toISOString(), 40)
    const last = bottle('b', zonedTime(2026, 9, 23, 14, 0).toISOString(), 240)

    it('inserts a focused day without entries, between the other days', () => {
      render(
        <TrendEntriesList
          kind="feeding"
          colorVar="--category-feeding"
          entries={[first, last]}
          onSelect={vi.fn()}
          focusDayKey="2026-09-22"
        />,
      )

      const headings = screen.getAllByRole('heading')
      expect(headings.map((h) => h.textContent)).toEqual(['Sep 23, 2026', 'Sep 22, 2026', 'Sep 21, 2026'])
      expect(headings[1]).toHaveClass('is-focused')
      expect(headings[0]).not.toHaveClass('is-focused')
      const emptyDay = screen.getByRole('region', { name: 'Sep 22, 2026' })
      expect(within(emptyDay).getByText('No entries this day')).toBeInTheDocument()
    })

    it('highlights the focused day when it has entries, without adding a day', () => {
      render(
        <TrendEntriesList
          kind="feeding"
          colorVar="--category-feeding"
          entries={[first, last]}
          onSelect={vi.fn()}
          focusDayKey="2026-09-23"
        />,
      )

      const headings = screen.getAllByRole('heading')
      expect(headings.map((h) => h.textContent)).toEqual(['Sep 23, 2026', 'Sep 21, 2026'])
      expect(headings[0]).toHaveClass('is-focused')
      expect(screen.queryByText('No entries this day')).not.toBeInTheDocument()
    })

    it('still shows the focused day when there is no entry at all', () => {
      render(
        <TrendEntriesList
          kind="feeding"
          colorVar="--category-feeding"
          entries={[]}
          onSelect={vi.fn()}
          focusDayKey="2026-09-22"
        />,
      )

      expect(screen.getByRole('heading', { name: 'Sep 22, 2026' })).toHaveClass('is-focused')
      expect(screen.getByText('No entries this day')).toBeInTheDocument()
      expect(screen.queryByText('No entries for this period')).not.toBeInTheDocument()
    })
  })
})
