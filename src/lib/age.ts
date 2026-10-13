import { startOfDay, zonedParts, zonedTime } from './appTime'
import { parseDayKey } from './timeline'

/** Days in a month as the WHO growth standards count age: an average month, 365.25 / 12. */
export const DAYS_PER_WHO_MONTH = 365.25 / 12
const DAYS_PER_WEEK = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** A `YYYY-MM-DD` birth date is Paris midnight of that day. */
function parseBirthDate(birthDate: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? parseDayKey(birthDate) : new Date(birthDate)
}

/** Fractional age in WHO months (of 365.25 / 12 days), the unit of the WHO growth tables. */
export function ageInMonths(birthDate: string, at: Date): number {
  const birth = parseBirthDate(birthDate)
  const totalDays = (at.getTime() - birth.getTime()) / MS_PER_DAY
  return Math.max(0, totalDays / DAYS_PER_WHO_MONTH)
}

/** Paris midnight of the `months`-th monthly birthday (the month's last day when it is shorter). */
function monthBirthday(year: number, month: number, day: number, months: number): Date {
  const index = year * 12 + (month - 1) + months
  const targetYear = Math.floor(index / 12)
  const targetMonth = (index % 12) + 1
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  return zonedTime(targetYear, targetMonth, Math.min(day, daysInMonth))
}

/** Calendar days between two Paris midnights (rounded: a day of 23 or 25 hours still counts as one). */
function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

/** Age in calendar months, then weeks and days, in Paris days: "12m", "1m 1w 3d", "5d". */
export function formatAge(birthDate: string, now: Date): string {
  const birth = parseBirthDate(birthDate)
  const { year, month, day } = zonedParts(birth)
  const today = startOfDay(now)

  let months = 0
  if (today.getTime() > zonedTime(year, month, day).getTime()) {
    const { year: todayYear, month: todayMonth } = zonedParts(today)
    months = (todayYear - year) * 12 + (todayMonth - month)
    if (monthBirthday(year, month, day, months).getTime() > today.getTime()) months -= 1
  }
  const totalDays = Math.max(0, daysBetween(monthBirthday(year, month, day, months), today))
  const weeks = Math.floor(totalDays / DAYS_PER_WEEK)
  const days = totalDays % DAYS_PER_WEEK

  const parts: string[] = []
  if (months > 0) parts.push(`${months}m`)
  if (weeks > 0) parts.push(`${weeks}w`)
  if (days > 0 || parts.length === 0) parts.push(`${days}d`)

  return parts.join(' ')
}
