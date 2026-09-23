import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import { dayKey } from '../lib/timeline'
import type { SleepEntry } from '../types/models'
import { WeekTimelineChart } from './WeekTimelineChart'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('WeekTimelineChart', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
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
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
    })

    const { container } = render(
      <WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey="2026-03-05" />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the seven day columns and calls onSelectDay when a header is clicked', async () => {
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
    })
    const onSelectDay = vi.fn()
    const user = userEvent.setup()
    const today = new Date()

    render(<WeekTimelineChart onSelectDay={onSelectDay} selectedDayKey={dayKey(today)} />)

    const headers = screen.getAllByRole('button', { name: /See details for/ })
    expect(headers).toHaveLength(7)

    await user.click(headers[0])
    expect(onSelectDay).toHaveBeenCalled()
  })

  it('hides sleep blocks when the Sleep kind is excluded from visibleKinds', () => {
    const sleep: SleepEntry = {
      id: 's1',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: new Date().toISOString(),
    }
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [sleep],
      diaper: [],
      medication: [],
    })

    const { container, rerender } = render(
      <WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />,
    )

    expect(container.querySelectorAll('.week-chart-block')).toHaveLength(1)

    rerender(
      <WeekTimelineChart
        onSelectDay={vi.fn()}
        selectedDayKey={dayKey(new Date())}
        visibleKinds={new Set(['feeding', 'diaper', 'medication'])}
      />,
    )
    expect(container.querySelectorAll('.week-chart-block')).toHaveLength(0)
  })

  it('omits the hour axis and per-day bar columns when showChart is false', () => {
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
    })

    const { container } = render(
      <WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} showChart={false} />,
    )

    expect(container.querySelectorAll('.week-chart-axis')).toHaveLength(0)
    expect(container.querySelectorAll('.week-chart-column')).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /See details for/ })).toHaveLength(7)
  })

  it('changes the displayed month label when navigating to the previous week', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T12:00:00.000Z')) // Monday of the first week of March
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
    })
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)
    expect(screen.getByText('March 2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

    expect(screen.getByText('February 2026')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
