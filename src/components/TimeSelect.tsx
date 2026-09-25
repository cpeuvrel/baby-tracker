const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

interface TimeSelectProps {
  label: string
  /** `HH:mm`, or '' when not set. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Hour and minute pickers, always in 24-hour format. A native `input[type=time]`
 * follows the phone's locale and can show AM/PM.
 */
export function TimeSelect({ label, value, onChange, disabled }: TimeSelectProps) {
  const [hour = '', minute = ''] = value ? value.split(':') : []

  const change = (nextHour: string, nextMinute: string) => {
    onChange(`${nextHour || '00'}:${nextMinute || '00'}`)
  }

  return (
    <span className="time-select">
      <select
        aria-label={`${label} hour`}
        value={hour}
        disabled={disabled}
        onChange={(event) => change(event.target.value, minute)}
      >
        {!value && <option value="">--</option>}
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select
        aria-label={`${label} minute`}
        value={minute}
        disabled={disabled}
        onChange={(event) => change(hour, event.target.value)}
      >
        {!value && <option value="">--</option>}
        {MINUTES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </span>
  )
}
