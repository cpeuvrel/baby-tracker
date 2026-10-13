import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { rollingDayFrame } from '../lib/timeline'
import { MetricCalendar } from './MetricCalendar'

const dayKeys = ['2026-03-03', '2026-03-04', '2026-03-05']

describe('MetricCalendar', () => {
  it('labels the hour axis from midnight for calendar days', () => {
    const { container } = render(
      <MetricCalendar dayKeys={dayKeys} colorVar="--category-sleep" selectedKey={null} onSelectDay={() => {}} />,
    )

    const labels = [...container.querySelectorAll('.timeline-grid-axis span')].map((label) => label.textContent)
    expect(labels).toEqual(['00', '03', '06', '09', '12', '15', '18', '21', '24'])
  })

  it('labels the axis with the exact times of a rolling window\'s grid lines', () => {
    const now = new Date('2026-03-05T14:37:00+01:00')
    const { container } = render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
        now={now}
        frame={rollingDayFrame(now)}
      />,
    )

    const labels = [...container.querySelectorAll('.timeline-grid-axis span')].map((label) => label.textContent)
    expect(labels).toEqual(['14:37', '17:37', '20:37', '23:37', '02:37', '05:37', '08:37', '11:37', '14:37'])
  })

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
        blocks={[{ start: new Date('2026-03-04T21:00:00+01:00'), end: new Date('2026-03-04T22:00:00+01:00') }]}
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
        marks={[{ at: new Date('2026-03-05T10:00:00+01:00') }]}
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

  it('draws calendar days from midnight, splitting a night across two columns, faded when not in the metric', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
        blocks={[
          // 21:00 on the 3rd → 07:00 on the 4th: the end of the 3rd's column and the top of the 4th's.
          { start: new Date('2026-03-03T21:00:00+01:00'), end: new Date('2026-03-04T07:00:00+01:00'), faded: true },
        ]}
      />,
    )

    const columns = document.querySelectorAll('.timeline-grid-column')
    const evening = columns[0].querySelector<HTMLElement>('.timeline-grid-block')
    expect(parseFloat(evening!.style.top)).toBeCloseTo((21 / 24) * 100)
    expect(parseFloat(evening!.style.height)).toBeCloseTo((3 / 24) * 100)
    const morning = columns[1].querySelector<HTMLElement>('.timeline-grid-block')
    expect(morning!.style.top).toBe('0%')
    expect(parseFloat(morning!.style.height)).toBeCloseTo((7 / 24) * 100)
    expect(morning).toHaveClass('is-faded')
    expect(screen.getByText('00')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('marks the current time on today\'s column and highlights today', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
        now={new Date('2026-03-05T06:00:00+01:00')}
      />,
    )

    const columns = document.querySelectorAll('.timeline-grid-column')
    const now = columns[2].querySelector<HTMLElement>('.timeline-grid-now')
    expect(parseFloat(now!.style.top)).toBeCloseTo(25)
    expect(document.querySelectorAll('.timeline-grid-now')).toHaveLength(1)
    expect(document.querySelectorAll('.timeline-grid-day-header')[2]).toHaveClass('is-selected')
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

  it('shades the night as paler bands', () => {
    render(
      <MetricCalendar
        dayKeys={dayKeys}
        colorVar="--category-sleep"
        selectedKey={null}
        onSelectDay={() => {}}
        nightRange={{ start: '20:00', end: '08:00' }}
      />,
    )

    const bands = document.querySelectorAll<HTMLElement>('.timeline-grid-scroller .timeline-grid-night')
    expect(bands).toHaveLength(2)
    expect(bands[0].style.top).toBe('0%')
    expect(parseFloat(bands[0].style.height)).toBeCloseTo((8 / 24) * 100)
    expect(parseFloat(bands[1].style.top)).toBeCloseTo((20 / 24) * 100)
  })
})
