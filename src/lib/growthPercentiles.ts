import { WHO_GROWTH_TABLES, type LmsRow, type Sex } from './whoGrowthData'
import type { GrowthMetric } from './growthMetrics'

export type { Sex }

export const REFERENCE_PERCENTILES = [2, 5, 10, 25, 50, 75, 90, 95, 98] as const

const MAX_AGE_MONTHS = 24

function interpolateLms(rows: LmsRow[], ageMonths: number): LmsRow {
  const clamped = Math.max(rows[0].ageMonths, Math.min(ageMonths, rows[rows.length - 1].ageMonths))
  let lower = rows[0]
  let upper = rows[rows.length - 1]
  for (let i = 0; i < rows.length - 1; i++) {
    if (clamped >= rows[i].ageMonths && clamped <= rows[i + 1].ageMonths) {
      lower = rows[i]
      upper = rows[i + 1]
      break
    }
  }
  if (lower.ageMonths === upper.ageMonths) return lower
  const t = (clamped - lower.ageMonths) / (upper.ageMonths - lower.ageMonths)
  return {
    ageMonths: clamped,
    L: lower.L + t * (upper.L - lower.L),
    M: lower.M + t * (upper.M - lower.M),
    S: lower.S + t * (upper.S - lower.S),
    p: lower.p.map((value, index) => value + t * (upper.p[index] - value)),
  }
}

/** WHO Child Growth Standards cover birth to 24 months; ages outside that range have no reference. */
export function isWithinWhoRange(ageMonths: number): boolean {
  return ageMonths >= 0 && ageMonths <= MAX_AGE_MONTHS
}

export function getLmsAt(metric: GrowthMetric, sex: Sex, ageMonths: number): LmsRow | undefined {
  if (!isWithinWhoRange(ageMonths)) return undefined
  const rows = WHO_GROWTH_TABLES[metric][sex]
  return interpolateLms(rows, ageMonths)
}

function zScore(lms: LmsRow, value: number): number {
  const { L, M, S } = lms
  if (Math.abs(L) < 1e-9) return Math.log(value / M) / S
  return (Math.pow(value / M, L) - 1) / (L * S)
}

/** Standard normal CDF via the Abramowitz & Stegun 7.1.26 approximation (max error ~1.5e-7). */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/** The child's percentile (0-100) for a measurement, or undefined outside the WHO 0-24 month range. */
export function percentileForValue(
  metric: GrowthMetric,
  sex: Sex,
  ageMonths: number,
  value: number,
): number | undefined {
  const lms = getLmsAt(metric, sex, ageMonths)
  if (!lms) return undefined
  const percentile = normalCdf(zScore(lms, value)) * 100
  return Math.min(100, Math.max(0, percentile))
}

export interface ReferenceCurvePoint {
  ageMonths: number
  values: number[]
}

/** One point per WHO age row (0-24 months), with a value for each of REFERENCE_PERCENTILES. */
export function referenceCurves(metric: GrowthMetric, sex: Sex): ReferenceCurvePoint[] {
  return WHO_GROWTH_TABLES[metric][sex].map((row) => ({ ageMonths: row.ageMonths, values: row.p }))
}
