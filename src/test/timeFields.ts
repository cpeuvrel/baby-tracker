import { fireEvent, screen } from '@testing-library/react'

/** Current `HH:mm` of a 24-hour `TimeSelect` labelled `label`. */
export function timeValue(label: string): string {
  const hour = (screen.getByLabelText(`${label} hour`) as HTMLSelectElement).value
  const minute = (screen.getByLabelText(`${label} minute`) as HTMLSelectElement).value
  return `${hour}:${minute}`
}

/** Current `YYYY-MM-DDTHH:mm` of a `DateTimeField` labelled `label`. */
export function dateTimeValue(label: string): string {
  return `${(screen.getByLabelText(label) as HTMLInputElement).value}T${timeValue(label)}`
}

export function setTime(label: string, value: string) {
  const [hour, minute] = value.split(':')
  fireEvent.change(screen.getByLabelText(`${label} hour`), { target: { value: hour } })
  fireEvent.change(screen.getByLabelText(`${label} minute`), { target: { value: minute } })
}

export function setDateTime(label: string, value: string) {
  const [date, time] = value.split('T')
  fireEvent.change(screen.getByLabelText(label), { target: { value: date } })
  setTime(label, time)
}
