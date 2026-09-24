import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetricCalendar } from './MetricCalendar'

const dayKeys = ['2026-03-03', '2026-03-04', '2026-03-05']

describe('MetricCalendar', () => {
  it('renders one column per day key', () => {
    render(<MetricCalendar dayKeys={dayKeys} colorVar="--category-sleep" />)

    expect(screen.getAllByText('3')).toHaveLength(1)
    expect(document.querySelectorAll('.week-chart-day')).toHaveLength(3)
  })

  it('renders a block for each interval within a day', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        intervals={[
          { start: new Date('2026-03-04T21:00:00+01:00'), end: new Date('2026-03-04T22:00:00+01:00') },
        ]}
      />,
    )

    expect(document.querySelectorAll('.week-chart-block')).toHaveLength(1)
  })

  it('renders a mark for each instant', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-feeding"
        instants={[new Date('2026-03-05T10:00:00+01:00')]}
      />,
    )

    expect(document.querySelectorAll('.week-chart-mark')).toHaveLength(1)
  })
})
