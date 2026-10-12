import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DateTimeField } from './DateTimeField'

describe('DateTimeField', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the date and the time of its value', () => {
    render(<DateTimeField id="at" label="Time" value="2026-03-03T08:15" onChange={vi.fn()} />)

    expect(screen.getByLabelText('Time')).toHaveValue('2026-03-03')
    expect(screen.getByLabelText('Time hour')).toHaveValue('08')
    expect(screen.getByLabelText('Time minute')).toHaveValue('15')
  })

  it('reports a new date with the current time', () => {
    const onChange = vi.fn()
    render(<DateTimeField id="at" label="Time" value="2026-03-03T08:15" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-03-02' } })

    expect(onChange).toHaveBeenCalledWith('2026-03-02T08:15')
  })

  it('clears the value when the date is cleared, instead of moving it to today', () => {
    const onChange = vi.fn()
    render(<DateTimeField id="at" label="Time" value="2026-03-03T08:15" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('takes today for a time typed while no date is set', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T10:00:00+02:00'))
    const onChange = vi.fn()
    render(<DateTimeField id="at" label="Time" value="" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Time hour'), { target: { value: '07' } })

    expect(onChange).toHaveBeenCalledWith('2026-10-12T07:00')
  })

  it('calls onBlur once the focus leaves both parts, not when it moves between them', async () => {
    const user = userEvent.setup()
    const onBlur = vi.fn()
    render(
      <>
        <DateTimeField id="at" label="Time" value="2026-03-03T08:15" onChange={vi.fn()} onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )

    await user.click(screen.getByLabelText('Time hour'))
    await user.click(screen.getByLabelText('Time minute'))
    expect(onBlur).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})
