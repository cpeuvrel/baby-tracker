import { useRef, useState } from 'react'

interface TimeSelectProps {
  label: string
  /** `HH:mm`, or '' when not set. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

interface TimePartInputProps {
  label: string
  /** Two digits, or '' when not set. */
  value: string
  max: number
  disabled?: boolean
  onCommit: (value: string) => void
  /** Called once two digits are typed, to move on to the next field. */
  onFilled?: () => void
  inputRef?: React.Ref<HTMLInputElement>
}

/**
 * One two-digit field typed on the numeric keypad. Only the last two digits count, like a
 * digital clock (with "00" shown, typing 3 then 0 gives "03" then "30"), so a tap that leaves
 * the cursor after the current value never blocks typing. Each valid entry is committed right
 * away; an out-of-range one is ignored and the last valid value shows again on blur.
 */
function TimePartInput({ label, value, max, disabled, onCommit, onFilled, inputRef }: TimePartInputProps) {
  // What is typed, while the field has focus (it may be partial, e.g. "1" before "15").
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      placeholder="--"
      aria-label={label}
      value={draft ?? value}
      disabled={disabled}
      onFocus={(event) => {
        setDraft(value)
        event.target.select()
      }}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '').slice(-2)
        // Only a field being typed in shows its draft; a programmatic change shows the committed value.
        if (event.target === document.activeElement) setDraft(digits)
        if (digits === '' || Number(digits) > max) return
        onCommit(digits.padStart(2, '0'))
        if (digits.length === 2) onFilled?.()
      }}
    />
  )
}

/**
 * Hour and minute fields, always in 24-hour format and typed on the numeric keypad.
 * A native `input[type=time]` follows the phone's locale and can show AM/PM.
 */
export function TimeSelect({ label, value, onChange, disabled }: TimeSelectProps) {
  const [hour = '', minute = ''] = value ? value.split(':') : []
  const minuteRef = useRef<HTMLInputElement>(null)

  const change = (nextHour: string, nextMinute: string) => {
    onChange(`${nextHour || '00'}:${nextMinute || '00'}`)
  }

  return (
    <span className="time-select">
      <TimePartInput
        label={`${label} hour`}
        value={hour}
        max={23}
        disabled={disabled}
        onCommit={(nextHour) => change(nextHour, minute)}
        onFilled={() => minuteRef.current?.focus()}
      />
      <span aria-hidden="true">:</span>
      <TimePartInput
        label={`${label} minute`}
        value={minute}
        max={59}
        disabled={disabled}
        onCommit={(nextMinute) => change(hour, nextMinute)}
        inputRef={minuteRef}
      />
    </span>
  )
}
