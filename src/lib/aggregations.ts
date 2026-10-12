import { parseClock, zonedParts, type ClockTime } from './appTime'
import type { FeedingEntry, NighttimeHours, SleepEntry } from '../types/models'

export const DEFAULT_NIGHTTIME_HOURS: NighttimeHours = { start: '20:00', end: '08:00' }

const DEFAULT_NIGHT_START: ClockTime = { hour: 20, minute: 0 }
const DEFAULT_NIGHT_END: ClockTime = { hour: 8, minute: 0 }

/** The night's bounds as clock times, a malformed one (corrupted data) replaced by the default's. */
export function nightClocks(nightRange: NighttimeHours): { start: ClockTime; end: ClockTime } {
  return {
    start: parseClock(nightRange.start) ?? DEFAULT_NIGHT_START,
    end: parseClock(nightRange.end) ?? DEFAULT_NIGHT_END,
  }
}

function minutesOf(clock: ClockTime): number {
  return clock.hour * 60 + clock.minute
}

/** Whether `date` falls in the nighttime hours (Paris wall-clock time, to the minute). */
export function isDuringNight(date: Date, nightRange: NighttimeHours): boolean {
  const { hour, minute } = zonedParts(date)
  const at = hour * 60 + minute
  const clocks = nightClocks(nightRange)
  const start = minutesOf(clocks.start)
  const end = minutesOf(clocks.end)
  return start <= end ? at >= start && at < end : at >= start || at < end
}

/** Whether `startedAt` falls in the nighttime hours. */
export function startsDuringNight(startedAt: string, nightRange: NighttimeHours): boolean {
  return isDuringNight(new Date(startedAt), nightRange)
}

export interface SleepStats {
  totalSeconds: number
  averageSecondsPerDay: number
  nightWakings: number
}

export function computeSleepStats(
  entries: SleepEntry[],
  dayCount: number,
  nightRange: NighttimeHours = DEFAULT_NIGHTTIME_HOURS,
): SleepStats {
  const totalSeconds = entries.reduce((sum, entry) => sum + (entry.durationSeconds ?? 0), 0)
  const nightWakings = entries.filter((entry) => startsDuringNight(entry.startedAt, nightRange)).length

  return {
    totalSeconds,
    averageSecondsPerDay: dayCount > 0 ? totalSeconds / dayCount : 0,
    nightWakings,
  }
}

export interface FeedingStats {
  bottleCount: number
  solidCount: number
  totalVolumeMl: number
  averageVolumeMl: number | null
}

export function computeFeedingStats(entries: FeedingEntry[]): FeedingStats {
  const bottles = entries.filter((entry) => entry.type === 'bottle')
  const solids = entries.filter((entry) => entry.type === 'solid')
  const volumes = bottles
    .map((entry) => entry.volumeMl)
    .filter((volume): volume is number => volume != null)
  const totalVolumeMl = volumes.reduce((sum, volume) => sum + volume, 0)

  return {
    bottleCount: bottles.length,
    solidCount: solids.length,
    totalVolumeMl,
    averageVolumeMl: volumes.length > 0 ? totalVolumeMl / volumes.length : null,
  }
}

export interface DailyPoint {
  dayKey: string
  value: number
}

export interface Delta {
  value: number
  direction: 'up' | 'down' | 'flat'
}

export function computeDelta(current: number, previous: number): Delta {
  const value = current - previous
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  return { value, direction }
}
