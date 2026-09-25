import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MetricCalendar } from './MetricCalendar'

const dayKeys = ['2026-03-03', '2026-03-04', '2026-03-05']

describe('MetricCalendar', () => {
  it('renders one column per day key', () => {
    render(<MetricCalendar dayKeys={dayKeys} colorVar="--category-sleep" selectedKey={null} onSelectDay={() => {}} />)

    expect(screen.getAllByText('3')).toHaveLength(1)
    expect(document.querySelectorAll('.week-chart-day')).toHaveLength(3)
  })

  it('renders a block for each interval within a day', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
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
        selectedKey={null}
        onSelectDay={() => {}}
        instants={[new Date('2026-03-05T10:00:00+01:00')]}
      />,
    )

    expect(document.querySelectorAll('.week-chart-mark')).toHaveLength(1)
  })

  it('selects a day from its date or its column, and clears it on a second tap', async () => {
    const user = userEvent.setup()
    const onSelectDay = vi.fn()
    const { rerender } = render(
      <MetricCalendar dayKeys={dayKeys} colorVar="--category-sleep" selectedKey={null} onSelectDay={onSelectDay} />,
    )

    await user.click(screen.getAllByRole('button', { name: /\d$/ })[0])
    expect(onSelectDay).toHaveBeenLastCalledWith('2026-03-03')
    await user.click(screen.getAllByRole('button', { name: /timeline$/ })[1])
    expect(onSelectDay).toHaveBeenLastCalledWith('2026-03-04')

    rerender(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey="2026-03-04"
        onSelectDay={onSelectDay}
      />,
    )
    const selected = screen.getAllByRole('button', { pressed: true })
    expect(selected).toHaveLength(2)
    expect(selected[0]).toHaveClass('is-selected')
    await user.click(selected[1])
    expect(onSelectDay).toHaveBeenLastCalledWith(null)
  })
})
