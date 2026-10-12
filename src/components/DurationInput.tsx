interface DurationInputProps {
  totalMinutes: number | null
  onChange: (totalMinutes: number | null) => void
  disabled?: boolean
  /** Prefix of the two inputs' ids, unique in the page (the labels point at them). */
  idPrefix?: string
}

/** A typed hours or minutes part: blank is 0, a negative is 0, anything not a number is null. */
function parsePart(value: string): number | null {
  if (value.trim() === '') return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, parsed)
}

export function DurationInput({ totalMinutes, onChange, disabled, idPrefix = 'sleep-duration' }: DurationInputProps) {
  // An end before the start gives a negative total: shown as 0, the form says what is wrong.
  const shownMinutes = totalMinutes != null ? Math.max(0, totalMinutes) : null
  const hoursPart = shownMinutes != null ? Math.floor(shownMinutes / 60) : ''
  const minutesPart = shownMinutes != null ? shownMinutes % 60 : ''
  const hoursId = `${idPrefix}-hours`
  const minutesId = `${idPrefix}-minutes`

  const handleChange = (hoursValue: string, minutesValue: string) => {
    if (hoursValue.trim() === '' && minutesValue.trim() === '') {
      onChange(null)
      return
    }
    const hours = parsePart(hoursValue)
    const minutes = parsePart(minutesValue)
    if (hours == null || minutes == null) return
    onChange(hours * 60 + minutes)
  }

  return (
    <div className="duration-input">
      <div>
        <label htmlFor={hoursId}>Hours</label>
        <input
          id={hoursId}
          type="number"
          min="0"
          inputMode="numeric"
          value={hoursPart}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value, String(minutesPart))}
        />
      </div>
      <div>
        <label htmlFor={minutesId}>Minutes</label>
        <input
          id={minutesId}
          type="number"
          min="0"
          max="59"
          inputMode="numeric"
          value={minutesPart}
          disabled={disabled}
          onChange={(event) => handleChange(String(hoursPart), event.target.value)}
        />
      </div>
    </div>
  )
}
