import { describe, expect, it } from 'vitest'
import { parseOptionalPositive } from './numberInput'

describe('parseOptionalPositive', () => {
  it('is null for a blank field', () => {
    expect(parseOptionalPositive('')).toBeNull()
    expect(parseOptionalPositive('  ')).toBeNull()
  })

  it('returns a positive number', () => {
    expect(parseOptionalPositive('120')).toBe(120)
    expect(parseOptionalPositive('6.235')).toBe(6.235)
  })

  it('refuses 0, negatives and what is not a number', () => {
    expect(parseOptionalPositive('0')).toBe('invalid')
    expect(parseOptionalPositive('-5')).toBe('invalid')
    expect(parseOptionalPositive('abc')).toBe('invalid')
    expect(parseOptionalPositive('Infinity')).toBe('invalid')
  })
})
