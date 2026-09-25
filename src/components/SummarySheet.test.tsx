import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import { zonedTime } from '../lib/appTime'
import type { FeedingEntry, SleepEntry } from '../types/models'
import { SummarySheet } from './SummarySheet'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Maëlys', birthDate: '2025-06-01', sex: null }
const now = zonedTime(2026, 9, 25, 18, 3)

function bottle(occurredAt: Date, volumeMl: number): FeedingEntry {
  const iso = occurredAt.toISOString()
  return { id: iso, type: 'bottle', occurredAt: iso, volumeMl, foodType: null, notes: '', createdBy: 'u', createdAt: iso }
}

function sleep(startedAt: Date, endedAt: Date): SleepEntry {
  return {
    id: startedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds: (endedAt.getTime() - startedAt.getTime()) / 1000,
    notes: '',
    createdBy: 'u',
    createdAt: startedAt.toISOString(),
  }
}

describe('SummarySheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    localStorage.clear()
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [
        bottle(zonedTime(2026, 9, 24, 20, 30), 150),
        bottle(zonedTime(2026, 9, 25, 8, 15), 140),
        bottle(zonedTime(2026, 9, 25, 16, 1), 180),
      ],
      sleep: [
        sleep(zonedTime(2026, 9, 24, 19, 37), zonedTime(2026, 9, 25, 7, 25)),
        sleep(zonedTime(2026, 9, 25, 15, 1), zonedTime(2026, 9, 25, 16, 1)),
      ],
      diaper: [],
      medication: [],
      bath: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("totals today's entries, counting only the part of last night's sleep after midnight", () => {
    render(<SummarySheet onClose={vi.fn()} />)

    expect(screen.getByText('Bottle Feed')).toBeInTheDocument()
    expect(screen.getByText('320 mL total')).toBeInTheDocument()
    expect(screen.getByText('8h 25m total sleep')).toBeInTheDocument()
  })

  it('switches to the last 24 hours', async () => {
    const user = userEvent.setup()
    render(<SummarySheet onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Last 24 Hours' }))

    expect(screen.getByText('470 mL total')).toBeInTheDocument()
    expect(screen.getByText('12h 48m total sleep')).toBeInTheDocument()
  })

  it('leaves out categories hidden in Edit Activities', () => {
    localStorage.setItem('baby-tracker:hiddenActivities', JSON.stringify(['sleep']))

    render(<SummarySheet onClose={vi.fn()} />)

    expect(screen.getByText('Bottle Feed')).toBeInTheDocument()
    expect(screen.queryByText('Sleep')).not.toBeInTheDocument()
  })
})
