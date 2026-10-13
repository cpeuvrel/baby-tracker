import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DailyPoint } from '../lib/aggregations'
import { MetricGraph } from './MetricGraph'

const data: DailyPoint[] = [
  { dayKey: '2026-03-02', value: 2 },
  { dayKey: '2026-03-03', value: 0 },
  { dayKey: '2026-03-04', value: 4 },
]

function renderGraph(props: Partial<React.ComponentProps<typeof MetricGraph>> = {}) {
  const handlers = {
    onSelectDay: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  }
  render(
    <MetricGraph
      data={data}
      average={2}
      ticks={[0, 2, 4]}
      chartStyle="bar"
      colorVar="--category-feeding"
      icon={<span>icon</span>}
      seriesLabel="Feedings"
      formatValue={(value) => `${value} feeds`}
      formatTick={String}
      selectedKey={null}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

const graph = () => screen.getByRole('region', { name: 'Metric graph' })
const column = () => screen.getByRole('button', { name: /Mar 4: 4 feeds/ })

describe('MetricGraph', () => {
  it('goes to the next period when swiping left, and ignores the click that ends the swipe', () => {
    const { onNext, onPrevious, onSelectDay } = renderGraph()

    fireEvent.pointerDown(graph(), { pointerId: 1, clientX: 200 })
    fireEvent.pointerUp(graph(), { pointerId: 1, clientX: 100 })
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrevious).not.toHaveBeenCalled()

    // The browser still dispatches a click after the swipe: it must not select a day.
    fireEvent.click(column())
    expect(onSelectDay).not.toHaveBeenCalled()

    // Only that one click is swallowed.
    fireEvent.click(column())
    expect(onSelectDay).toHaveBeenCalledWith('2026-03-04')
  })

  it('goes to the previous period when swiping right', () => {
    const { onNext, onPrevious } = renderGraph()

    fireEvent.pointerDown(graph(), { pointerId: 1, clientX: 100 })
    fireEvent.pointerUp(graph(), { pointerId: 1, clientX: 200 })

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('treats a short movement as a tap, not a swipe', () => {
    const { onNext, onPrevious, onSelectDay } = renderGraph()

    fireEvent.pointerDown(graph(), { pointerId: 1, clientX: 100 })
    fireEvent.pointerUp(graph(), { pointerId: 1, clientX: 51 })
    fireEvent.click(column())

    expect(onNext).not.toHaveBeenCalled()
    expect(onPrevious).not.toHaveBeenCalled()
    expect(onSelectDay).toHaveBeenCalledWith('2026-03-04')
  })

  it('ignores a pointer release that follows a cancelled gesture', () => {
    const { onNext } = renderGraph()

    fireEvent.pointerDown(graph(), { pointerId: 1, clientX: 200 })
    fireEvent.pointerCancel(graph(), { pointerId: 1 })
    fireEvent.pointerUp(graph(), { pointerId: 1, clientX: 0 })

    expect(onNext).not.toHaveBeenCalled()
  })

  it('does not fail when swiping toward a period that does not exist', () => {
    const { onSelectDay } = renderGraph({ onNext: undefined, onPrevious: undefined })

    fireEvent.pointerDown(graph(), { pointerId: 1, clientX: 200 })
    fireEvent.pointerUp(graph(), { pointerId: 1, clientX: 100 })

    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous period' })).toBeDisabled()
    expect(onSelectDay).not.toHaveBeenCalled()
  })

  it('selects a day on tap', async () => {
    const user = userEvent.setup()
    const { onSelectDay } = renderGraph()
    await user.click(column())
    expect(onSelectDay).toHaveBeenLastCalledWith('2026-03-04')
  })

  it('clears the selected day when tapped again', async () => {
    const user = userEvent.setup()
    const { onSelectDay } = renderGraph({ selectedKey: '2026-03-04' })

    await user.click(column())

    expect(onSelectDay).toHaveBeenLastCalledWith(null)
    expect(column()).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the average in the legend when no day is selected', () => {
    renderGraph()

    expect(screen.getByText('Feedings', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('2 feeds', { selector: 'strong' })).toBeInTheDocument()
  })

  it('shows the selected day value in the legend', () => {
    renderGraph({ selectedKey: '2026-03-04' })

    expect(screen.getByText('Wed, Mar 4', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('4 feeds', { selector: 'strong' })).toBeInTheDocument()
  })
})
