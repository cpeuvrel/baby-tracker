import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MetricCalendar } from './MetricCalendar'

const dayKeys = ['2026-03-03', '2026-03-04', '2026-03-05']

describe('MetricCalendar', () => {
  it('renders one column per day key', () => {
    render(<MetricCalendar dayKeys={dayKeys} colorVar="--category-sleep" selectedKey={null} onSelectDay={() => {}} />)

    expect(screen.getAllByText('3')).toHaveLength(1)
    expect(document.querySelectorAll('.timeline-grid-day-header')).toHaveLength(3)
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

    expect(document.querySelectorAll('.timeline-grid-block')).toHaveLength(1)
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

    expect(document.querySelectorAll('.timeline-grid-mark')).toHaveLength(1)
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

  it('starts each column at dayStart the day before, for sleep days that start at night', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
        dayStart="20:00"
        intervals={[
          // 21:00 on the 3rd → 07:00 on the 4th: one block at the top of the 4th's column.
          { start: new Date('2026-03-03T21:00:00+01:00'), end: new Date('2026-03-04T07:00:00+01:00') },
        ]}
      />,
    )

    const columns = document.querySelectorAll('.timeline-grid-column')
    expect(columns[0].querySelectorAll('.timeline-grid-block')).toHaveLength(0)
    const block = columns[1].querySelector<HTMLElement>('.timeline-grid-block')
    expect(parseFloat(block!.style.top)).toBeCloseTo((1 / 24) * 100)
    expect(parseFloat(block!.style.height)).toBeCloseTo((10 / 24) * 100)
    expect(screen.getAllByText('20')).toHaveLength(2)
    expect(screen.getByText('02')).toBeInTheDocument()
  })

  it('changes period with the arrows, Next only when given', async () => {
    const user = userEvent.setup()
    const onPrevious = vi.fn()
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-feeding"
        selectedKey={null}
        onSelectDay={() => {}}
        onPrevious={onPrevious}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(onPrevious).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Next period' })).not.toBeInTheDocument()
  })

  it('shades the night relative to the column start', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
        dayStart="20:00"
        nightRange={{ start: '20:00', end: '08:00' }}
      />,
    )

    const bands = document.querySelectorAll<HTMLElement>('.timeline-grid-scroller .timeline-grid-night')
    expect(bands).toHaveLength(1)
    expect(bands[0].style.top).toBe('0%')
    expect(parseFloat(bands[0].style.height)).toBeCloseTo(50)
  })
})
