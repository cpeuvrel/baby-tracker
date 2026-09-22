import {
  averageVolumeByDay,
  countDiapersByDay,
  countFeedingSessionsByDay,
  countNightWakingsByDay,
  sumSecondsByDay,
  sumVolumeByDay,
  type DailyPoint,
} from './aggregations'
import { formatDuration } from './duration'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'

export type TrendMetricId =
  | 'feedSessions'
  | 'feedVolume'
  | 'feedAvgVolume'
  | 'sleepTotal'
  | 'nightWakings'
  | 'diaperCount'

export type TrendKind = 'feeding' | 'sleep' | 'diaper'

export interface TrendMetricMeta {
  id: TrendMetricId
  title: string
  section: string
  colorVar: string
  kind: TrendKind
}

export const TREND_METRICS: TrendMetricMeta[] = [
  {
    id: 'feedSessions',
    title: 'Biberons',
    section: 'Nourriture',
    colorVar: '--category-feeding',
    kind: 'feeding',
  },
  {
    id: 'feedVolume',
    title: 'Volume total',
    section: 'Nourriture',
    colorVar: '--category-feeding',
    kind: 'feeding',
  },
  {
    id: 'feedAvgVolume',
    title: 'Volume moyen',
    section: 'Nourriture',
    colorVar: '--category-feeding',
    kind: 'feeding',
  },
  {
    id: 'sleepTotal',
    title: 'Sommeil total',
    section: 'Sommeil',
    colorVar: '--category-sleep',
    kind: 'sleep',
  },
  {
    id: 'nightWakings',
    title: 'Réveils nocturnes',
    section: 'Sommeil',
    colorVar: '--category-sleep',
    kind: 'sleep',
  },
  {
    id: 'diaperCount',
    title: 'Couches',
    section: 'Couches',
    colorVar: '--category-diaper',
    kind: 'diaper',
  },
]

export function getTrendMetric(id: string): TrendMetricMeta | undefined {
  return TREND_METRICS.find((metric) => metric.id === id)
}

export interface TrendEntriesBundle {
  feeding: FeedingEntry[]
  sleep: SleepEntry[]
  diaper: DiaperEntry[]
}

export function computeMetricSeries(
  id: TrendMetricId,
  dayKeys: string[],
  entries: TrendEntriesBundle,
): DailyPoint[] {
  switch (id) {
    case 'feedSessions':
      return countFeedingSessionsByDay(dayKeys, entries.feeding)
    case 'feedVolume':
      return sumVolumeByDay(dayKeys, entries.feeding)
    case 'feedAvgVolume':
      return averageVolumeByDay(dayKeys, entries.feeding)
    case 'sleepTotal':
      return sumSecondsByDay(dayKeys, entries.sleep)
    case 'nightWakings':
      return countNightWakingsByDay(dayKeys, entries.sleep)
    case 'diaperCount':
      return countDiapersByDay(dayKeys, entries.diaper)
  }
}

export function formatMetricValue(id: TrendMetricId, value: number): string {
  switch (id) {
    case 'feedSessions':
    case 'nightWakings':
    case 'diaperCount':
      return value.toFixed(1)
    case 'feedVolume':
    case 'feedAvgVolume':
      return `${Math.round(value)} mL`
    case 'sleepTotal':
      return formatDuration(Math.round(value))
  }
}

const HEADLINE_SUFFIX: Record<TrendMetricId, string> = {
  feedSessions: 'biberons / jour',
  feedVolume: '/ jour',
  feedAvgVolume: 'en moyenne',
  sleepTotal: '/ jour',
  nightWakings: 'réveils / jour',
  diaperCount: 'couches / jour',
}

export function formatMetricHeadline(id: TrendMetricId, average: number): string {
  return `${formatMetricValue(id, average)} ${HEADLINE_SUFFIX[id]}`
}
