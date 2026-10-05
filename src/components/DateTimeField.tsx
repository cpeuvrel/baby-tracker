import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { TimeSelect } from './TimeSelect'

interface DateTimeFieldProps {
  id: string
  label: string
  /** `YYYY-MM-DDTHH:mm` (same as `input[type=datetime-local]`), or '' when not set. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Latest pickable `YYYY-MM-DDTHH:mm`; only the date picker enforces it. */
  max?: string
}

/** A date input plus a 24-hour time picker, in place of `input[type=datetime-local]`. */
export function DateTimeField({ id, label, value, onChange, disabled, max }: DateTimeFieldProps) {
  const [date = '', time = ''] = value ? value.split('T') : []

  const change = (nextDate: string, nextTime: string) => {
    if (!nextDate && !nextTime) {
      onChange('')
      return
    }
    // Picking a time first means today.
    const datePart = nextDate || toDatetimeLocalValue(new Date()).slice(0, 10)
    onChange(`${datePart}T${nextTime || '00:00'}`)
  }

  return (
    <div className="date-time-field">
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
