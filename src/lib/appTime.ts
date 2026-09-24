/**
 * The app's single time zone. Instants are stored in UTC (Firestore Timestamps / ISO strings);
 * every time shown or typed in the app is Paris wall-clock time, whatever the device's zone.
 */
export const APP_TIME_ZONE = 'Europe/Paris'

export interface ZonedParts {
  year: number
  /** 1–12 */
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  weekday: 'short',
})

/** Paris wall-clock fields of an instant. */
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
    weekday: WEEKDAYS.indexOf(fields.weekday),
  }
}

/** Offset of Paris from UTC at `ms`, in milliseconds (+1h in winter, +2h in summer). */
function offsetAt(ms: number): number {
  const wholeSecond = Math.floor(ms / 1000) * 1000
  const p = zonedParts(new Date(wholeSecond))
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - wholeSecond
}

/**
 * The instant at a given Paris wall-clock time. Out-of-range fields roll over
 * (day 32 → next month), like `new Date(y, m, d)`.
 */
export function zonedTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const firstGuess = asUtc - offsetAt(asUtc)
  const offset = offsetAt(firstGuess)
  return new Date(asUtc - offset)
}

/** Paris midnight starting the day of `date`. */
export function startOfDay(date: Date): Date {
  const p = zonedParts(date)
  return zonedTime(p.year, p.month, p.day)
}

/** Same Paris wall-clock time `days` calendar days later (negative for earlier). */
export function addDays(date: Date, days: number): Date {
  const p = zonedParts(date)
  return zonedTime(p.year, p.month, p.day + days, p.hour, p.minute, p.second)
}

/** Seconds since Paris midnight. */
export function secondsIntoDay(date: Date): number {
  const p = zonedParts(date)
  return p.hour * 3600 + p.minute * 60 + p.second
}

/** `toLocaleDateString` in the app's time zone. */
export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}, locale = 'en-US'): string {
  return date.toLocaleDateString(locale, { ...options, timeZone: APP_TIME_ZONE })
}

/** `toLocaleTimeString` in the app's time zone. */
export function formatTime(date: Date, options: Intl.DateTimeFormatOptions = {}, locale = 'en-US'): string {
  return date.toLocaleTimeString(locale, { ...options, timeZone: APP_TIME_ZONE })
}
