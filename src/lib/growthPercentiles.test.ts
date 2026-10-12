import { describe, expect, it } from 'vitest'
import type { GrowthMetric } from './growthMetrics'
import {
  percentileForValue,
  projectOnSamePercentile,
  referenceCurves,
  REFERENCE_PERCENTILES,
  type Sex,
} from './growthPercentiles'

const TABLES: Array<[GrowthMetric, Sex]> = [
  ['weight', 'male'],
  ['weight', 'female'],
  ['height', 'male'],
  ['height', 'female'],
  ['headCircumference', 'male'],
  ['headCircumference', 'female'],
]

/**
 * Published WHO percentiles (CDC "WHO-*-Percentiles.csv", internal units) at 0, 6, 12 and
 * 24 months: [age, P5, P50, P95]. They check the embedded LMS parameters, all 6 tables.
 */
const PUBLISHED: Record<string, Array<[number, number, number, number]>> = {
  'weight/male': [[0, 2603.99, 3346.4, 4214.53], [6, 6611.7, 7934, 9481.94], [12, 8052.58, 9647.9, 11535.26], [24, 10071.94, 12151.5, 14667.53]],
  'weight/female': [[0, 2532.15, 3232.2, 4040.96], [6, 5978.88, 7297, 8932.89], [12, 7342.38, 8948.1, 10995.31], [24, 9416.52, 11477.5, 14161.81]],
  'height/male': [[0, 467.7, 498.84, 529.98], [6, 641.03, 676.24, 711.44], [12, 718.4, 757.49, 796.57], [24, 827.91, 878.16, 928.41]],
  'height/female': [[0, 460.84, 491.48, 522.12], [6, 620.03, 657.31, 694.59], [12, 697.8, 740.15, 782.5], [24, 811.08, 864.15, 917.23]],
  'headCircumference/male': [[0, 323.72, 344.62, 365.51], [6, 413.23, 433.31, 453.38], [12, 439.53, 460.66, 481.79], [24, 460.13, 482.52, 504.9]],
  'headCircumference/female': [[0, 319.31, 338.79, 358.27], [6, 400.57, 422, 443.42], [12, 426.61, 448.97, 471.32], [24, 448.87, 471.82, 494.77]],
}

const P5 = REFERENCE_PERCENTILES.indexOf(5)
const P50 = REFERENCE_PERCENTILES.indexOf(50)
const P95 = REFERENCE_PERCENTILES.indexOf(95)

describe('referenceCurves', () => {
  it('returns one point per WHO age row, each with 9 percentile values', () => {
    const curve = referenceCurves('headCircumference', 'female')

    expect(curve).toHaveLength(25)
    expect(curve[0].ageMonths).toBe(0)
    expect(curve[24].ageMonths).toBe(24)
    curve.forEach((point) => expect(point.values).toHaveLength(REFERENCE_PERCENTILES.length))
  })

  it.each(TABLES)('matches the published WHO percentiles (%s, %s)', (metric, sex) => {
    const curve = referenceCurves(metric, sex)
    for (const [age, p5, p50, p95] of PUBLISHED[`${metric}/${sex}`]) {
      const { values } = curve[age]
      expect(Math.abs(values[P5] / p5 - 1)).toBeLessThan(0.003)
      expect(Math.abs(values[P50] / p50 - 1)).toBeLessThan(0.003)
      expect(Math.abs(values[P95] / p95 - 1)).toBeLessThan(0.003)
    }
  })

  it.each(TABLES)('increases with age and with the percentile (%s, %s)', (metric, sex) => {
    const curve = referenceCurves(metric, sex)
    curve.forEach((point, row) => {
      point.values.forEach((value, index) => {
        if (index > 0) expect(value).toBeGreaterThan(point.values[index - 1])
        if (row > 0) expect(value).toBeGreaterThan(curve[row - 1].values[index])
      })
    })
  })

  it.each(TABLES)('draws each curve exactly at its percentile, the outer ones included (%s, %s)', (metric, sex) => {
    for (const point of referenceCurves(metric, sex)) {
      REFERENCE_PERCENTILES.forEach((percentile, index) => {
        expect(percentileForValue(metric, sex, point.ageMonths, point.values[index])).toBeCloseTo(percentile, 3)
      })
    }
  })

  it('puts the 2nd percentile below z = -2 (the 2.3rd percentile)', () => {
    // Boys at birth: z = -2 is 2459.3 g, the true 2nd percentile 2437.9 g.
    expect(referenceCurves('weight', 'male')[0].values[0]).toBeCloseTo(2437.9, 0)
  })
})

describe('percentileForValue', () => {
  it('reports the 50th percentile for the median, interpolating between months', () => {
    expect(percentileForValue('weight', 'male', 6, 7934)).toBeCloseTo(50, 5)
    // Halfway between the 6- and 7-month medians at 6.5 months.
    expect(percentileForValue('weight', 'male', 6.5, (7934 + 8297) / 2)).toBeCloseTo(50, 5)
  })

  it('reports a higher percentile for a larger measurement', () => {
    const low = percentileForValue('height', 'male', 12, 740)!
    const high = percentileForValue('height', 'male', 12, 780)!
    expect(high).toBeGreaterThan(low)
  })

  it('covers birth to 24 months, and nothing outside', () => {
    expect(percentileForValue('weight', 'male', 0, 3346.4)).toBeCloseTo(50, 5)
    expect(percentileForValue('weight', 'male', 24, 12151.5)).toBeCloseTo(50, 5)
    expect(percentileForValue('weight', 'male', 24.5, 12000)).toBeUndefined()
    expect(percentileForValue('weight', 'male', 36, 12000)).toBeUndefined()
  })
})

describe('projectOnSamePercentile', () => {
  it('keeps the child on the same percentile at a later age', () => {
    const from = { ageMonths: 2, value: 5500 }
    const projected = projectOnSamePercentile('weight', 'female', from, 5) as number

    expect(projected).toBeGreaterThan(from.value)
    expect(percentileForValue('weight', 'female', 5, projected)).toBeCloseTo(
      percentileForValue('weight', 'female', 2, from.value) as number,
      4,
    )
  })

  it('projects the median onto the median', () => {
    const median = (age: number) => referenceCurves('height', 'male')[age].values[P50]
    expect(projectOnSamePercentile('height', 'male', { ageMonths: 3, value: median(3) }, 6)).toBeCloseTo(median(6), 6)
  })

  it('returns undefined when the target age is outside the WHO range', () => {
    expect(projectOnSamePercentile('weight', 'female', { ageMonths: 23, value: 11000 }, 25)).toBeUndefined()
  })
})
