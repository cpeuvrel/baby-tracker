import { describe, expect, it } from 'vitest'
import { formatGrowthValue } from './growthMetrics'

describe('formatGrowthValue', () => {
  it('uses the weight formatter for the weight metric', () => {
    expect(formatGrowthValue('weight', 6200)).toBe('6.20 kg')
  })

  it('uses the length formatter for height and head circumference', () => {
    expect(formatGrowthValue('height', 620)).toBe('62.0 cm')
    expect(formatGrowthValue('headCircumference', 410)).toBe('41.0 cm')
  })

  it('formats weights in kilograms (two decimals) or pounds', () => {
    expect(formatGrowthValue('weight', 6200)).toBe('6.20 kg')
    expect(formatGrowthValue('weight', 6200, 'imperial')).toBe('13.67 lb')
  })

  it('formats lengths in centimetres (one decimal) or inches', () => {
    expect(formatGrowthValue('height', 620, 'imperial')).toBe('24.4 in')
  })
})
