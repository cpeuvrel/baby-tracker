import { fromDatetimeLocalValue, toDatetimeLocalValue } from './datetimeInput'

/**
 * Start, end and duration of a sleep form. Each one is entered on its own; changing one fills in
 * or adapts the others:
 * - start: fills an empty end (start + duration), else adapts the duration;
 * - end: fills an empty start (end - duration), else adapts the duration;
 * - duration: moves the end (start + duration), or the start when only the end is set.
 */
export interface SleepTimes {
  /** `YYYY-MM-DDTHH:mm`, or '' when not set. */
  start: string
  /** `YYYY-MM-DDTHH:mm`, or '' when not set. */
  end: string
  /** Whole minutes, or null when not set. */
  duration: number | null
}

function shift(value: string, minutes: number): string {
  return toDatetimeLocalValue(new Date(fromDatetimeLocalValue(value).getTime() + minutes * 60000))
}

/** Minutes from `start` to `end`; null when the end comes before the start. */
function minutesBetween(start: string, end: string): number | null {
  const minutes = Math.round((fromDatetimeLocalValue(end).getTime() - fromDatetimeLocalValue(start).getTime()) / 60000)
  return minutes >= 0 ? minutes : null
}

export function withStart(times: SleepTimes, start: string): SleepTimes {
  if (start === '') return { ...times, start }
  if (times.end !== '') return { ...times, start, duration: minutesBetween(start, times.end) }
  if (times.duration != null) return { ...times, start, end: shift(start, times.duration) }
  return { ...times, start }
}

export function withEnd(times: SleepTimes, end: string): SleepTimes {
  if (end === '') return { ...times, end }
  if (times.start !== '') return { ...times, end, duration: minutesBetween(times.start, end) }
  if (times.duration != null) return { ...times, end, start: shift(end, -times.duration) }
  return { ...times, end }
}

export function withDuration(times: SleepTimes, duration: number | null): SleepTimes {
  if (duration == null) return { ...times, duration }
  if (times.start !== '') return { ...times, duration, end: shift(times.start, duration) }
  if (times.end !== '') return { ...times, duration, start: shift(times.end, -duration) }
  return { ...times, duration }
}
