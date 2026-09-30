import { describe, expect, it } from 'vitest'
import {
  getLmsAt,
  isWithinWhoRange,
  percentileForValue,
  projectOnSamePercentile,
  referenceCurves,
  REFERENCE_PERCENTILES,
} from './growthPercentiles'

describe('isWithinWhoRange', () => {
  it('accepts ages from birth to 24 months', () => {
    expect(isWithinWhoRange(0)).toBe(true)
    expect(isWithinWhoRange(12)).toBe(true)
    expect(isWithinWhoRange(24)).toBe(true)
  })

  it('rejects ages outside 0-24 months', () => {
    expect(isWithinWhoRange(-1)).toBe(false)
    expect(isWithinWhoRange(25)).toBe(false)
  })
})

describe('getLmsAt', () => {
  it('returns the exact table row for a whole month', () => {
    const lms = getLmsAt('weight', 'male', 0)
    expect(lms?.M).toBeCloseTo(3346.4, 1)
  })

  it('linearly interpolates between two months', () => {
    const start = getLmsAt('weight', 'male', 6)!
    const end = getLmsAt('weight', 'male', 7)!
    const mid = getLmsAt('weight', 'male', 6.5)!
    expect(mid.M).toBeCloseTo((start.M + end.M) / 2, 5)
  })

  it('returns undefined outside the WHO age range', () => {
    expect(getLmsAt('weight', 'male', 30)).toBeUndefined()
  })
})

describe('percentileForValue', () => {
  it('reports 50th percentile for the median value at a given age', () => {
    const lms = getLmsAt('weight', 'female', 6)!
    expect(percentileForValue('weight', 'female', 6, lms.M)).toBeCloseTo(50, 0)
  })

  it('matches the table reference points closely for weight', () => {
    const lms = getLmsAt('weight', 'male', 12)!
    REFERENCE_PERCENTILES.forEach((percentile, index) => {
      const value = lms.p[index]
      expect(percentileForValue('weight', 'male', 12, value)).toBeCloseTo(percentile, 0)
    })
  })

  it('reports a higher percentile for a larger measurement', () => {
    const lms = getLmsAt('height', 'male', 12)!
    const low = percentileForValue('height', 'male', 12, lms.M - 20)!
    const high = percentileForValue('height', 'male', 12, lms.M + 20)!
    expect(high).toBeGreaterThan(low)
  })

  it('returns undefined outside the WHO age range', () => {
    expect(percentileForValue('weight', 'male', 36, 12000)).toBeUndefined()
  })
})

describe('referenceCurves', () => {
  it('returns one point per WHO age row, each with 9 percentile values', () => {
    const curve = referenceCurves('headCircumference', 'female')

    expect(curve).toHaveLength(25)
    expect(curve[0].ageMonths).toBe(0)
    expect(curve[24].ageMonths).toBe(24)
    curve.forEach((point) => expect(point.values).toHaveLength(REFERENCE_PERCENTILES.length))
  })

  it('keeps each percentile curve monotonically increasing with age', () => {
    const curve = referenceCurves('weight', 'male')
    for (let i = 1; i < curve.length; i++) {
      curve[i].values.forEach((value, index) => {
        expect(value).toBeGreaterThan(curve[i - 1].values[index])
      })
    }
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
    expect(projectOnSamePercentile('height', 'male', { ageMonths: 3, value: getLmsAt('height', 'male', 3)!.M }, 6)).toBeCloseTo(
      getLmsAt('height', 'male', 6)!.M,
      6,
    )
  })

  it('returns undefined when the target age is outside the WHO range', () => {
    expect(projectOnSamePercentile('weight', 'female', { ageMonths: 23, value: 11000 }, 25)).toBeUndefined()
  })
})
