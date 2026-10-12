import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import { zonedTime } from '../lib/appTime'
import { TodayRecap } from './TodayRecap'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }
const now = zonedTime(2026, 3, 5, 18, 3)

function mockEntries(overrides: Partial<useEntriesInRangeModule.EntriesInRangeState> = {}) {
  vi.spyOn(useEntriesInRangeModule, 'useEntriesInRangeState').mockReturnValue({
    feeding: [],
    sleep: [],
    diaper: [],
    medication: [],
    bath: [],
    loading: false,
    error: null,
    ...overrides,
  })
}

describe('TodayRecap', () => {
  beforeEach(() => {
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("totals today's milk", () => {
    const at = zonedTime(2026, 3, 5, 9, 0).toISOString()
    mockEntries({
      feeding: [
        { id: 'f1', type: 'bottle', occurredAt: at, volumeMl: 120, foodType: null, notes: '', createdBy: 'u', createdAt: at },
      ],
    })

    render(<TodayRecap now={now} />)

    expect(screen.getByRole('region', { name: 'Today' })).toHaveTextContent('120 mLmilk')
  })

  it('says Loading… rather than zero totals until the entries arrive', () => {
    mockEntries({ loading: true })

    render(<TodayRecap now={now} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('0 mL')).not.toBeInTheDocument()
  })

  it('warns when live updates stopped, unless the screen already does', () => {
    mockEntries({ error: new Error('permission-denied') })

    const { rerender } = render(<TodayRecap now={now} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Live updates stopped')

    rerender(<TodayRecap now={now} errorShownAbove />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
