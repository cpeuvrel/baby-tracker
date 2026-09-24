import { parseDayKey } from './timeline'

const DAYS_PER_MONTH = 30
const DAYS_PER_WEEK = 7

/** A `YYYY-MM-DD` birth date is Paris midnight of that day. */
function parseBirthDate(birthDate: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? parseDayKey(birthDate) : new Date(birthDate)
}

/** Fractional age in months, using the same 30-day-month approximation as formatAge. */
export function ageInMonths(birthDate: string, at: Date): number {
  const birth = parseBirthDate(birthDate)
  const totalDays = (at.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, totalDays / DAYS_PER_MONTH)
}

export function formatAge(birthDate: string, now: Date): string {
  const birth = parseBirthDate(birthDate)
  const totalDays = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)))

  const months = Math.floor(totalDays / DAYS_PER_MONTH)
  const remainingAfterMonths = totalDays % DAYS_PER_MONTH
  const weeks = Math.floor(remainingAfterMonths / DAYS_PER_WEEK)
  const days = remainingAfterMonths % DAYS_PER_WEEK

  const parts: string[] = []
  if (months > 0) parts.push(`${months}m`)
  if (weeks > 0) parts.push(`${weeks}w`)
  if (days > 0 || parts.length === 0) parts.push(`${days}d`)

  return parts.join(' ')
}
