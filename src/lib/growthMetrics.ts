import type { UnitSystem } from '../hooks/useUnitPreference'
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

export const GRAMS_PER_POUND = 453.592
export const MM_PER_INCH = 25.4

export function formatWeightG(valueG: number, unit: UnitSystem = 'metric'): string {
  if (unit === 'imperial') {
    return `${(valueG / GRAMS_PER_POUND).toFixed(2)} lb`
  }
  return `${(valueG / 1000).toFixed(2)} kg`
}

export function formatLengthMm(valueMm: number, unit: UnitSystem = 'metric'): string {
  if (unit === 'imperial') {
    return `${(valueMm / MM_PER_INCH).toFixed(1)} in`
  }
  return `${(valueMm / 10).toFixed(1)} cm`
}

export function formatGrowthValue(
  metric: GrowthMetric,
  value: number,
  unit: UnitSystem = 'metric',
): string {
  return metric === 'weight' ? formatWeightG(value, unit) : formatLengthMm(value, unit)
}
