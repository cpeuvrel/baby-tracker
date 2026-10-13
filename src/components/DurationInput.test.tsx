import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DurationInput } from './DurationInput'

describe('DurationInput', () => {
  it('splits the total into hours and minutes', () => {
    render(<DurationInput totalMinutes={95} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Hours')).toHaveValue(1)
    expect(screen.getByLabelText('Minutes')).toHaveValue(35)
  })

  it('clamps a negative hours or minutes value to 0', () => {
    const onChange = vi.fn()
    render(<DurationInput totalMinutes={30} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '-1' } })
    expect(onChange).toHaveBeenLastCalledWith(30)

    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '-5' } })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('shows 0 h 0 min for a negative total instead of negative parts', () => {
    render(<DurationInput totalMinutes={-30} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Hours')).toHaveValue(0)
    expect(screen.getByLabelText('Minutes')).toHaveValue(0)
  })

  it('counts a cleared part as 0 and a typed part alone as the whole duration', () => {
    const onChange = vi.fn()
    const { rerender } = render(<DurationInput totalMinutes={5} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(0)

    rerender(<DurationInput totalMinutes={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith(120)
  })

  it('names its inputs from idPrefix so two instances keep their labels apart', () => {
    render(
      <>
        <DurationInput totalMinutes={60} onChange={vi.fn()} idPrefix="nap" />
        <DurationInput totalMinutes={120} onChange={vi.fn()} idPrefix="night" />
      </>,
    )

    const hours = screen.getAllByLabelText('Hours')
    expect(hours.map((input) => input.id)).toEqual(['nap-hours', 'night-hours'])
    expect(hours.map((input) => (input as HTMLInputElement).value)).toEqual(['1', '2'])
  })
})
