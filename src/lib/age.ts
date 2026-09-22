const DAYS_PER_MONTH = 30
const DAYS_PER_WEEK = 7

export function formatAge(birthDate: string, now: Date): string {
  const birth = new Date(birthDate)
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
