export function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
}

const SECONDS_PER_DAY = 86400

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY)
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}j ${String(hours).padStart(2, '0')}h`
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}min`
  }
  if (minutes > 0) {
    return `${minutes}min ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

export function formatRelativeTime(date: Date, now: Date): string {
  const totalSeconds = secondsBetween(date, now)
  if (totalSeconds < 60) return "à l'instant"

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return `il y a ${hours}h ${String(minutes).padStart(2, '0')}min`
  }
  return `il y a ${minutes}min`
}
