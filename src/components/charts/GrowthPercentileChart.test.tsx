import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GrowthPercentileChart } from './GrowthPercentileChart'

const points = [
  { id: 'a', ageMonths: 0, value: 3300 },
  { id: 'b', ageMonths: 3, value: 6000 },
]

function renderChart(onSelectPoint = vi.fn(), selectedId?: string) {
  const utils = render(
    <GrowthPercentileChart
      metric="weight"
      sex="female"
      unit="metric"
      childPoints={points}
      selectedId={selectedId}
      onSelectPoint={onSelectPoint}
    />,
  )
  const svg = screen.getByRole('img')
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect)
  return { ...utils, svg }
}

function pointCircles(container: HTMLElement) {
  return [...container.querySelectorAll('circle[r="7"]')]
}

describe('GrowthPercentileChart', () => {
  it('draws the nine WHO curves with their labels and one dot per measurement', () => {
    const { container } = renderChart()

    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
    expect(screen.getByText('months')).toBeInTheDocument()
    expect(screen.getByText(/kg$/)).toBeInTheDocument()
    expect(pointCircles(container)).toHaveLength(2)
  })

  it('selects the measurement nearest to a tap', () => {
    const onSelectPoint = vi.fn()
    const { container, svg } = renderChart(onSelectPoint)
    const dot = pointCircles(container)[1]

    fireEvent.pointerUp(svg, { clientX: Number(dot.getAttribute('cx')) + 10, clientY: Number(dot.getAttribute('cy')) - 5 })

    expect(onSelectPoint).toHaveBeenCalledWith('b')
  })

  it('clears the selection on a tap away from every point', () => {
    const onSelectPoint = vi.fn()
    const { svg } = renderChart(onSelectPoint, 'a')

    fireEvent.pointerUp(svg, { clientX: 5, clientY: 5 })

    expect(onSelectPoint).toHaveBeenCalledWith(undefined)
  })

  it('rings the selected point', () => {
    const { container } = renderChart(vi.fn(), 'b')

    expect(container.querySelector('circle[r="17"]')).toBeInTheDocument()
  })
})
