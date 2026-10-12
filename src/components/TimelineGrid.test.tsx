import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimelineGrid } from './TimelineGrid'

const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
const WEEK_BEFORE = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']

function grid(dayKeys: string[], onReachStart: () => void) {
  return (
    <TimelineGrid
      dayKeys={dayKeys}
      visibleDays={7}
      scrollable
      onReachStart={onReachStart}
      axisLabels={['00', '12', '24']}
      selectedKey={null}
      todayKey="2026-10-05"
      onSelectDay={vi.fn()}
      dayLabel={(key) => key}
      weekdayLabel={() => 'Mo'}
      renderColumn={() => null}
    />
  )
}

function scrollToStart(container: HTMLElement) {
  const scroller = container.querySelector('.timeline-grid-scroller') as HTMLElement
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 })
  scroller.scrollLeft = 0
  fireEvent.scroll(scroller)
}

describe('TimelineGrid', () => {
  it('asks for earlier days once per first day, however many scroll events arrive', () => {
    const onReachStart = vi.fn()
    const { container, rerender } = render(grid(WEEK, onReachStart))

    scrollToStart(container)
    scrollToStart(container)
    expect(onReachStart).toHaveBeenCalledTimes(1)

    // Earlier days loaded: reaching the new first day asks again.
    rerender(grid([...WEEK_BEFORE, ...WEEK], onReachStart))
    scrollToStart(container)
    scrollToStart(container)
    expect(onReachStart).toHaveBeenCalledTimes(2)
  })
})
