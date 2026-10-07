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
})
