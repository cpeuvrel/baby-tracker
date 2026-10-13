import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TimeSelect } from './TimeSelect'

function Harness({ initial = '', onChange = vi.fn() }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <TimeSelect
      label="Start"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('TimeSelect', () => {
  it('shows two numeric-keypad fields, padded to two digits', () => {
    render(<Harness initial="07:05" />)

    const hour = screen.getByLabelText('Start hour')
    expect(hour).toHaveAttribute('inputmode', 'numeric')
    expect(hour).toHaveValue('07')
    expect(screen.getByLabelText('Start minute')).toHaveValue('05')
  })

  it('takes typed digits, then jumps to the minutes once the hour has two', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="07:05" onChange={onChange} />)

    await user.click(screen.getByLabelText('Start hour'))
    await user.keyboard('21')

    expect(screen.getByLabelText('Start minute')).toHaveFocus()
    await user.keyboard('45')

    expect(onChange).toHaveBeenLastCalledWith('21:45')
  })

  it('pads a single digit once the field is left', async () => {
    const user = userEvent.setup()
    render(<Harness initial="07:05" />)

    await user.click(screen.getByLabelText('Start hour'))
    await user.keyboard('9')
    await user.tab()

    expect(screen.getByLabelText('Start hour')).toHaveValue('09')
  })

  it('ignores an out-of-range value and shows the last valid one again', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="07:05" onChange={onChange} />)

    await user.click(screen.getByLabelText('Start minute'))
    await user.keyboard('75')
    await user.tab()

    expect(onChange).toHaveBeenLastCalledWith('07:07')
    expect(screen.getByLabelText('Start minute')).toHaveValue('07')
  })

  it('keeps only the last two digits when the cursor sits after the value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="07:05" onChange={onChange} />)

    const hour = screen.getByLabelText('Start hour')
    await user.click(hour)
    await user.keyboard('{End}1')

    // "071" -> "71": out of range, nothing committed, the draft keeps what was typed.
    expect(onChange).not.toHaveBeenCalled()
    expect(hour).toHaveValue('71')

    await user.keyboard('9')

    expect(onChange).toHaveBeenLastCalledWith('19:05')
    expect(screen.getByLabelText('Start minute')).toHaveFocus()
    expect(hour).toHaveValue('19')
  })

  it('accepts a new entry after leaving the field with an invalid draft', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="07:05" onChange={onChange} />)

    const minute = screen.getByLabelText('Start minute')
    await user.click(minute)
    await user.keyboard('65')
    await user.tab()
    // The "6" was committed as "06"; the out-of-range "65" was ignored.
    expect(minute).toHaveValue('06')
    expect(onChange).toHaveBeenLastCalledWith('07:06')

    await user.click(minute)
    await user.keyboard('30')

    expect(onChange).toHaveBeenLastCalledWith('07:30')
    expect(minute).toHaveValue('30')
  })
})
