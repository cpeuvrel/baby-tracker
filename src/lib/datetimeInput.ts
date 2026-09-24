import { zonedParts, zonedTime } from './appTime'

/** `input[type=datetime-local]` value showing `date` in Paris time. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const p = zonedParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** The instant typed in an `input[type=datetime-local]`, read as Paris time. */
export function fromDatetimeLocalValue(value: string): Date {
  const [datePart, timePart = '00:00'] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return zonedTime(year, month, day, hour, minute)
}
