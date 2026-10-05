import { secondsIntoDay } from './appTime'
import { CALENDAR_DAYS, nextDayKey, type DayFrame } from './timeline'
import type { NighttimeHours } from '../types/models'

export interface DayBlock {
  dayKey: string
  startFraction: number
  endFraction: number
}

export interface DayMark {
  dayKey: string
  atFraction: number
}

/** Part of its day of `frame` (0 at the day's start → 1 at its end) at which `date` falls, by wall-clock time. */
function fractionOfDay(date: Date, frame: DayFrame): number {
  return (((secondsIntoDay(date) - frame.startSeconds) % 86400) + 86400) % 86400 / 86400
}

/** Splits a [start, end) interval into one block per day of `frame` (calendar days by default) it touches. */
export function splitIntervalByDay(start: Date, end: Date, frame: DayFrame = CALENDAR_DAYS): DayBlock[] {
  if (end.getTime() <= start.getTime()) return []

  const blocks: DayBlock[] = []
  let segmentStart = start

  while (segmentStart.getTime() < end.getTime()) {
    const key = frame.keyOf(segmentStart)
    const nextDayStart = frame.startOf(nextDayKey(key))
    const segmentEnd = end.getTime() < nextDayStart.getTime() ? end : nextDayStart

    blocks.push({
      dayKey: key,
      startFraction: fractionOfDay(segmentStart, frame),
      endFraction:
        segmentEnd.getTime() === nextDayStart.getTime() ? 1 : fractionOfDay(segmentEnd, frame),
    })

    segmentStart = segmentEnd
  }

  return blocks
}

export function markForInstant(at: Date, frame: DayFrame = CALENDAR_DAYS): DayMark {
  return { dayKey: frame.keyOf(at), atFraction: fractionOfDay(at, frame) }
}

export function buildWeekBlocks(
  weekDayKeys: string[],
  intervals: Array<{ start: Date; end: Date }>,
): Record<string, DayBlock[]> {
  const result: Record<string, DayBlock[]> = Object.fromEntries(weekDayKeys.map((key) => [key, []]))
  for (const interval of intervals) {
    for (const block of splitIntervalByDay(interval.start, interval.end)) {
      if (block.dayKey in result) result[block.dayKey].push(block)
    }
  }
  return result
}

export function buildWeekMarks(
  weekDayKeys: string[],
  instants: Date[],
): Record<string, DayMark[]> {
  const result: Record<string, DayMark[]> = Object.fromEntries(weekDayKeys.map((key) => [key, []]))
  for (const instant of instants) {
    const mark = markForInstant(instant)
    if (mark.dayKey in result) result[mark.dayKey].push(mark)
  }
  return result
}

/** Part of a day at which a `HH:MM` time falls, for a day starting `startSeconds` after midnight. */
function minutesFraction(time: string, startSeconds = 0): number {
  const [hour, minute] = time.split(':').map(Number)
  return ((((hour * 3600 + minute * 60 - startSeconds) % 86400) + 86400) % 86400) / 86400
}

/**
 * Night parts of a day as [start, end) fractions: two bands when the night wraps past the
 * day's start (midnight, or `startSeconds` after it for rolling days).
 */
export function nightFractions(night: NighttimeHours, startSeconds = 0): { start: number; end: number }[] {
  const start = minutesFraction(night.start, startSeconds)
  const end = minutesFraction(night.end, startSeconds)
  if (start === end) return []
  if (start < end) return [{ start, end }]
  return [
    { start: 0, end },
    { start, end: 1 },
  ].filter((band) => band.end > band.start)
}
