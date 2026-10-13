import type { FocusEvent } from 'react'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { TimeSelect } from './TimeSelect'

interface DateTimeFieldProps {
  id: string
  label: string
  /** `YYYY-MM-DDTHH:mm` (same as `input[type=datetime-local]`), or '' when not set. */
  value: string
  onChange: (value: string) => void
  /** Called when the focus leaves the whole field (date and time parts), e.g. to save once. */
  onBlur?: () => void
  disabled?: boolean
  /** Latest pickable `YYYY-MM-DDTHH:mm`; only the date picker enforces it. */
  max?: string
}

/** A date input plus a 24-hour time picker, in place of `input[type=datetime-local]`. */
export function DateTimeField({ id, label, value, onChange, onBlur, disabled, max }: DateTimeFieldProps) {
  const [date = '', time = ''] = value ? value.split('T') : []

  const change = (nextDate: string, nextTime: string) => {
    if (nextDate) {
      onChange(`${nextDate}T${nextTime || '00:00'}`)
      return
    }
    // Clearing the date clears the value (never moves it to today); only a time typed while no
    // date is set yet means today.
    if (date || !nextTime) {
      onChange('')
      return
    }
    onChange(`${toDatetimeLocalValue(new Date()).slice(0, 10)}T${nextTime}`)
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (onBlur && !event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur()
  }

  return (
    <div className="date-time-field" onBlur={handleBlur}>
      <label htmlFor={id}>{label}</label>
      <div className="date-time-field-inputs">
        <input
          id={id}
          type="date"
          value={date}
          max={max?.slice(0, 10)}
          disabled={disabled}
          onChange={(event) => change(event.target.value, time)}
        />
        <TimeSelect label={label} value={time} disabled={disabled} onChange={(nextTime) => change(date, nextTime)} />
      </div>
    </div>
  )
}
