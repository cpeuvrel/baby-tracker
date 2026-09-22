import { dayKey } from './timeline'
import type { DiaperEntry, DiaperType, FeedingEntry, SleepEntry } from '../types/models'

const NIGHT_START_HOUR = 20
const NIGHT_END_HOUR = 7

function startsDuringNight(startedAt: string): boolean {
  const hour = new Date(startedAt).getHours()
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
}

export interface SleepStats {
  totalSeconds: number
  averageSecondsPerDay: number
  nightWakings: number
}

export function computeSleepStats(entries: SleepEntry[], dayCount: number): SleepStats {
  const totalSeconds = entries.reduce((sum, entry) => sum + (entry.durationSeconds ?? 0), 0)
  const nightWakings = entries.filter((entry) => startsDuringNight(entry.startedAt)).length

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

export type DiaperStats = Record<DiaperType, number>

export function computeDiaperStats(entries: DiaperEntry[]): DiaperStats {
  const stats: DiaperStats = { pee: 0, poop: 0, both: 0 }
  for (const entry of entries) {
    stats[entry.type] += 1
  }
  return stats
}

export interface DailyPoint {
  dayKey: string
  value: number
}

export function sumSecondsByDay(dayKeys: string[], entries: SleepEntry[]): DailyPoint[] {
  const totals = new Map<string, number>(dayKeys.map((key) => [key, 0]))
  for (const entry of entries) {
    const key = dayKey(new Date(entry.startedAt))
    if (totals.has(key)) {
      totals.set(key, (totals.get(key) ?? 0) + (entry.durationSeconds ?? 0))
    }
  }
  return dayKeys.map((key) => ({ dayKey: key, value: totals.get(key) ?? 0 }))
}

export function sumVolumeByDay(dayKeys: string[], entries: FeedingEntry[]): DailyPoint[] {
  const totals = new Map<string, number>(dayKeys.map((key) => [key, 0]))
  for (const entry of entries) {
    if (entry.type !== 'bottle' || entry.volumeMl == null) continue
    const key = dayKey(new Date(entry.occurredAt))
    if (totals.has(key)) {
      totals.set(key, (totals.get(key) ?? 0) + entry.volumeMl)
    }
  }
  return dayKeys.map((key) => ({ dayKey: key, value: totals.get(key) ?? 0 }))
}
