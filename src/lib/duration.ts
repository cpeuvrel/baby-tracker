export function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
}

const SECONDS_PER_DAY = 86400

/** A finished duration, to the minute: "45m", "1h 05m", "1d 02h". */
export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY)
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h`
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  return `${minutes}m`
}

/** A running timer, ticking every second below an hour: "42s", "2m 05s", then like formatDuration. */
export function formatElapsed(totalSeconds: number): string {
  if (totalSeconds >= 3600) return formatDuration(totalSeconds)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

export function formatRelativeTime(date: Date, now: Date): string {
  const totalSeconds = secondsBetween(date, now)
  if (totalSeconds < 60) return 'just now'

  const days = Math.floor(totalSeconds / SECONDS_PER_DAY)
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`
  }
  return `${minutes}m ago`
}
