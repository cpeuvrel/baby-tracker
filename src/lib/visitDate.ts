import { formatDate, zonedParts } from './appTime'

/** Today's Paris calendar day as "YYYY-MM-DD" (an `input[type=date]` value). */
export function todayDateValue(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const p = zonedParts(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** "2026-10-08" → "Thu, Oct 8, 2026"; anything else (corrupted data) is shown as it is. */
export function formatVisitDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const [year, month, day] = match.slice(1).map(Number)
  // Noon UTC falls on the same calendar day in Paris.
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  // "2026-02-31" would roll over to March.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value
  return formatDate(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
