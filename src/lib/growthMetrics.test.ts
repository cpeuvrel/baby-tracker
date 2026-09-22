import { describe, expect, it } from 'vitest'
import { formatGrowthValue, formatLengthMm, formatWeightG } from './growthMetrics'

describe('formatWeightG', () => {
  it('formats grams as kilograms with two decimals', () => {
    expect(formatWeightG(6200)).toBe('6.20 kg')
  })
})

describe('formatLengthMm', () => {
  it('formats millimeters as centimeters with one decimal', () => {
    expect(formatLengthMm(620)).toBe('62.0 cm')
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
})
