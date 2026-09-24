/**
 * Reminder times are Paris wall-clock times, but Cloud Functions run in UTC:
 * read the current time in Paris explicitly (same rule as the web app's src/lib/appTime.ts).
 */
export const APP_TIME_ZONE = 'Europe/Paris'

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function zonedParts(date: Date): ZonedParts {
  const fields: Record<string, string> = {}
  for (const part of partsFormatter.formatToParts(date)) fields[part.type] = part.value
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
  }
}

function offsetAt(ms: number): number {
  const wholeSecond = Math.floor(ms / 1000) * 1000
  const p = zonedParts(new Date(wholeSecond))
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - wholeSecond
}

/** Paris midnight starting the day of `date`. */
export function startOfParisDay(date: Date): Date {
  const p = zonedParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day)
  return new Date(asUtc - offsetAt(asUtc - offsetAt(asUtc)))
}
