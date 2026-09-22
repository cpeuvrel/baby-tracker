import { describe, expect, it } from 'vitest'
import { toDatetimeLocalValue } from './datetimeInput'

describe('toDatetimeLocalValue', () => {
  it('formats a date as an input[type=datetime-local] value', () => {
    expect(toDatetimeLocalValue(new Date(2026, 2, 5, 8, 30))).toBe('2026-03-05T08:30')
  })

  it('pads single-digit month, day, hour and minute', () => {
    expect(toDatetimeLocalValue(new Date(2026, 0, 2, 4, 5))).toBe('2026-01-02T04:05')
  })
})
