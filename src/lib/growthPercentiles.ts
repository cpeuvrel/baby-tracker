import { WHO_GROWTH_TABLES, type LmsRow, type Sex } from './whoGrowthData'
import type { GrowthMetric } from './growthMetrics'

export type { Sex }

export const REFERENCE_PERCENTILES = [2, 5, 10, 25, 50, 75, 90, 95, 98] as const

/** Oldest age (months) the WHO growth standards cover. */
export const WHO_MAX_AGE_MONTHS = 24

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
  }
}

/** WHO Child Growth Standards cover birth to 24 months; ages outside that range have no reference. */
function isWithinWhoRange(ageMonths: number): boolean {
  return ageMonths >= 0 && ageMonths <= WHO_MAX_AGE_MONTHS
}

function getLmsAt(metric: GrowthMetric, sex: Sex, ageMonths: number): LmsRow | undefined {
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

/**
 * Inverse of the standard normal CDF (Acklam's rational approximation, relative error
 * below 1.2e-9): the z-score of the `p`-th quantile, 0 < p < 1.
 */
function inverseNormal(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const low = 0.02425
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - low) return -inverseNormal(1 - p)
  const q = p - 0.5
  const r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** z-score of each of REFERENCE_PERCENTILES. */
const REFERENCE_Z_SCORES = REFERENCE_PERCENTILES.map((percentile) => inverseNormal(percentile / 100))

/** Inverse of zScore: the measurement sitting at `z` standard deviations for these LMS parameters. */
function valueForZ(lms: LmsRow, z: number): number {
  const { L, M, S } = lms
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z)
  return M * Math.pow(1 + L * S * z, 1 / L)
}

/**
 * The value a measurement would have at `toAgeMonths` if the child stayed on the same
 * percentile (same z-score), or undefined when either age is outside the WHO range.
 */
export function projectOnSamePercentile(
  metric: GrowthMetric,
  sex: Sex,
  from: { ageMonths: number; value: number },
  toAgeMonths: number,
): number | undefined {
  const fromLms = getLmsAt(metric, sex, from.ageMonths)
  const toLms = getLmsAt(metric, sex, toAgeMonths)
  if (!fromLms || !toLms) return undefined
  return valueForZ(toLms, zScore(fromLms, from.value))
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

/**
 * One point per WHO age row (0-24 months), with the value at each of REFERENCE_PERCENTILES,
 * derived from the row's LMS parameters (so a point drawn on the "2" curve is at the 2nd percentile).
 */
export function referenceCurves(metric: GrowthMetric, sex: Sex): ReferenceCurvePoint[] {
  return WHO_GROWTH_TABLES[metric][sex].map((row) => ({
    ageMonths: row.ageMonths,
    values: REFERENCE_Z_SCORES.map((z) => valueForZ(row, z)),
  }))
}
