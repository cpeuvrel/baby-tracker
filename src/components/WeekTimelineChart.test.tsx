import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import { dayKey } from '../lib/timeline'
import type { SleepEntry } from '../types/models'
import { nightFractions } from '../lib/weekTimeline'
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
      bath: [],
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
      bath: [],
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
      bath: [],
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
      bath: [],
    })

    const { container } = render(
      <WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} showChart={false} />,
    )

    expect(container.querySelectorAll('.week-chart-axis')).toHaveLength(0)
    expect(container.querySelectorAll('.week-chart-column')).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /See details for/ })).toHaveLength(7)
  })

  it('shows a month tab on the first column and on the 1st of a new month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z')) // week of Mon Sep 28 – Sun Oct 4
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)

    expect(screen.getByText('Sep')).toBeInTheDocument()
    expect(screen.getByText('Oct')).toBeInTheDocument()
  })

  it('changes the month tab when navigating to the previous week, and back with Next', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T12:00:00.000Z')) // Monday of the first week of March
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next week' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(screen.getByText('Feb')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByText('Mar')).toBeInTheDocument()
  })

  it('navigates weeks with horizontal swipes, ignoring vertical drags', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T12:00:00.000Z'))
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)
    const section = screen.getByRole('region', { name: 'Week calendar' })
    const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
      fireEvent.touchStart(section, { touches: [{ clientX: fromX, clientY: fromY }] })
      fireEvent.touchEnd(section, { changedTouches: [{ clientX: toX, clientY: toY }] })
    }

    swipe(50, 250) // swipe right: previous week
    expect(screen.getByText('Feb')).toBeInTheDocument()

    swipe(100, 120, 0, 300) // mostly vertical: ignored
    expect(screen.getByText('Feb')).toBeInTheDocument()

    swipe(250, 50) // swipe left: next week
    expect(screen.getByText('Mar')).toBeInTheDocument()

    swipe(250, 50) // already on the current week: stays
    expect(screen.getByText('Mar')).toBeInTheDocument()
  })

  it('shades the night hours of the baby, defaulting to 20:00–08:00', () => {
    mockNoEntries()
    const { container, rerender } = render(
      <WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />,
    )
    const bands = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.week-chart-night')).map((el) => [
        el.style.top,
        el.style.height,
      ])
    expect(bands()).toEqual([
      ['0%', `${(8 / 24) * 100}%`],
      [`${(20 / 24) * 100}%`, `${(4 / 24) * 100}%`],
    ])

    const nightOwl = { ...baby, nighttimeHours: { start: '19:00', end: '07:00' } }
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [nightOwl],
      loading: false,
      error: null,
      selectedBaby: nightOwl,
      selectBaby: vi.fn(),
    })
    rerender(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)
    expect(bands()[1][0]).toBe(`${(19 / 24) * 100}%`)
  })
})

describe('nightFractions', () => {
  it('splits a night that wraps past midnight into two bands', () => {
    expect(nightFractions({ start: '18:00', end: '06:00' })).toEqual([
      { start: 0, end: 0.25 },
      { start: 0.75, end: 1 },
    ])
  })

  it('keeps a single band for a night that does not wrap, and none when empty', () => {
    expect(nightFractions({ start: '00:00', end: '06:00' })).toEqual([{ start: 0, end: 0.25 }])
    expect(nightFractions({ start: '08:00', end: '08:00' })).toEqual([])
  })
})

function mockNoEntries() {
  vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
    feeding: [],
    sleep: [],
    diaper: [],
    medication: [],
    bath: [],
  })
}
