import { dayKey } from './timeline'

export interface DayBlock {
  dayKey: string
  startFraction: number
  endFraction: number
}

export interface DayMark {
  dayKey: string
  atFraction: number
}

function fractionOfDay(date: Date): number {
  return (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400
}

/** Splits a [start, end) interval into one block per calendar day it touches. */
export function splitIntervalByDay(start: Date, end: Date): DayBlock[] {
  if (end.getTime() <= start.getTime()) return []

  const blocks: DayBlock[] = []
  let segmentStart = start

  while (segmentStart.getTime() < end.getTime()) {
    const nextMidnight = new Date(segmentStart)
    nextMidnight.setHours(24, 0, 0, 0)
    const segmentEnd = end.getTime() < nextMidnight.getTime() ? end : nextMidnight

    blocks.push({
      dayKey: dayKey(segmentStart),
      startFraction: fractionOfDay(segmentStart),
      endFraction:
        segmentEnd.getTime() === nextMidnight.getTime() ? 1 : fractionOfDay(segmentEnd),
    })

    segmentStart = segmentEnd
  }

  return blocks
}

export function markForInstant(at: Date): DayMark {
  return { dayKey: dayKey(at), atFraction: fractionOfDay(at) }
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
