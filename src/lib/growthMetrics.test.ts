import { describe, expect, it } from 'vitest'
import { formatGrowthValue, formatLengthMm, formatWeightG } from './growthMetrics'

describe('formatWeightG', () => {
  it('formats grams as kilograms with two decimals by default', () => {
    expect(formatWeightG(6200)).toBe('6.20 kg')
  })

  it('formats grams as pounds when imperial is requested', () => {
    expect(formatWeightG(6200, 'imperial')).toBe('13.67 lb')
  })
})

describe('formatLengthMm', () => {
  it('formats millimeters as centimeters with one decimal by default', () => {
    expect(formatLengthMm(620)).toBe('62.0 cm')
  })

  it('formats millimeters as inches when imperial is requested', () => {
    expect(formatLengthMm(620, 'imperial')).toBe('24.4 in')
  })
})

describe('formatGrowthValue', () => {
  it('uses the weight formatter for the weight metric', () => {
    expect(formatGrowthValue('weight', 6200)).toBe('6.20 kg')
  })

  it('uses the length formatter for height and head circumference', () => {
    expect(formatGrowthValue('height', 620)).toBe('62.0 cm')
    expect(formatGrowthValue('headCircumference', 410)).toBe('41.0 cm')
  })

  it('forwards the unit system to the underlying formatter', () => {
    expect(formatGrowthValue('weight', 6200, 'imperial')).toBe('13.67 lb')
  })
})
