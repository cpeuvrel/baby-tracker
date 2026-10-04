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

  it('renders eight weeks of day columns ending with the current week and selects a day on tap', async () => {
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
    expect(headers).toHaveLength(56)
    expect(headers[55]).toHaveAccessibleName(/^See details for /)

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

    expect(container.querySelectorAll('.timeline-grid-block')).toHaveLength(1)

    rerender(
      <WeekTimelineChart
        onSelectDay={vi.fn()}
        selectedDayKey={dayKey(new Date())}
        visibleKinds={new Set(['feeding', 'diaper', 'medication'])}
      />,
    )
    expect(container.querySelectorAll('.timeline-grid-block')).toHaveLength(0)
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

    expect(container.querySelectorAll('.timeline-grid-axis')).toHaveLength(0)
    expect(container.querySelectorAll('.timeline-grid-column')).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /See details for/ })).toHaveLength(56)
  })

  it('shows one sticky month tab per month across the loaded weeks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z')) // Sunday: weeks from Mon Aug 10 to Sun Oct 4
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)

    expect(Array.from(document.querySelectorAll('.timeline-grid-month-tab'), (el) => el.textContent)).toEqual([
      'Aug',
      'Sep',
      'Oct',
    ])
  })

  it('snaps on each Monday so a swipe moves one week at most', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z'))
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)

    const snapped = Array.from(document.querySelectorAll('.timeline-grid-day-header.is-snap'))
    expect(snapped).toHaveLength(8)
    expect(snapped.every((el) => el.textContent?.startsWith('Mo'))).toBe(true)
  })

  it('loads earlier weeks when scrolled back to the first week', () => {
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)
    const scroller = document.querySelector('.timeline-grid-scroller') as HTMLElement
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })

    scroller.scrollLeft = 0
    fireEvent.scroll(scroller)

    expect(screen.getAllByRole('button', { name: /See details for/ })).toHaveLength(112)
  })

  it('offers Next week only once scrolled back from the current week', () => {
    mockNoEntries()
    render(<WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />)
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next week' })).not.toBeInTheDocument()

    const scroller = document.querySelector('.timeline-grid-scroller') as HTMLElement
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 2400 })
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })
    scroller.scrollLeft = 1500
    fireEvent.scroll(scroller)

    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
  })

  it('shades the night hours of the baby, defaulting to 20:00–08:00', () => {
    mockNoEntries()
    const { container, rerender } = render(
      <WeekTimelineChart onSelectDay={vi.fn()} selectedDayKey={dayKey(new Date())} />,
    )
    // Drawn behind the axis and behind the day columns.
    const bands = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.timeline-grid-scroller .timeline-grid-night')).map(
        (el) => [el.style.top, el.style.height],
      )
    expect(container.querySelectorAll('.timeline-grid-night')).toHaveLength(4)
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
