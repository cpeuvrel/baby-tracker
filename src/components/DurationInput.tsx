interface DurationInputProps {
  totalMinutes: number | null
  onChange: (totalMinutes: number | null) => void
  disabled?: boolean
}

export function DurationInput({ totalMinutes, onChange, disabled }: DurationInputProps) {
  const hoursPart = totalMinutes != null ? Math.floor(totalMinutes / 60) : ''
  const minutesPart = totalMinutes != null ? totalMinutes % 60 : ''

  const handleChange = (hoursValue: string, minutesValue: string) => {
    if (hoursValue.trim() === '' && minutesValue.trim() === '') {
      onChange(null)
      return
    }
    const hours = hoursValue.trim() === '' ? 0 : Number(hoursValue)
    const minutes = minutesValue.trim() === '' ? 0 : Number(minutesValue)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return
    onChange(hours * 60 + minutes)
  }

  return (
    <div className="duration-input">
      <div>
        <label htmlFor="sleep-duration-hours">Hours</label>
        <input
          id="sleep-duration-hours"
          type="number"
          min="0"
          inputMode="numeric"
          value={hoursPart}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value, String(minutesPart))}
        />
      </div>
      <div>
        <label htmlFor="sleep-duration-minutes">Minutes</label>
        <input
          id="sleep-duration-minutes"
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
