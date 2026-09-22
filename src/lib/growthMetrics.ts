import type { GrowthEntry } from '../types/models'

export type GrowthMetric = 'weight' | 'height' | 'headCircumference'

export const GROWTH_METRIC_LABELS: Record<GrowthMetric, string> = {
  weight: 'Poids',
  height: 'Taille',
  headCircumference: 'Périmètre crânien',
}

export const GROWTH_METRIC_FIELD: Record<GrowthMetric, keyof GrowthEntry> = {
  weight: 'weightG',
  height: 'heightMm',
  headCircumference: 'headCircumferenceMm',
}

export function formatWeightG(valueG: number): string {
  return `${(valueG / 1000).toFixed(2)} kg`
}

export function formatLengthMm(valueMm: number): string {
  return `${(valueMm / 10).toFixed(1)} cm`
}

export function formatGrowthValue(metric: GrowthMetric, value: number): string {
  return metric === 'weight' ? formatWeightG(value) : formatLengthMm(value)
}
