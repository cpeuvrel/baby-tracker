import { formatDate, zonedParts } from './appTime'

/** Today's Paris calendar day as "YYYY-MM-DD" (an `input[type=date]` value). */
export function todayDateValue(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const p = zonedParts(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** "2026-10-08" → "Thu, Oct 8, 2026". */
export function formatVisitDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  // Noon UTC falls on the same calendar day in Paris.
  return formatDate(new Date(Date.UTC(year, month - 1, day, 12)), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
