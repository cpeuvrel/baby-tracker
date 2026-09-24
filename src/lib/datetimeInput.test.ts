import { describe, expect, it } from 'vitest'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from './datetimeInput'

describe('toDatetimeLocalValue', () => {
  it('shows the instant in Paris time', () => {
    expect(toDatetimeLocalValue(new Date('2026-03-05T07:30:00Z'))).toBe('2026-03-05T08:30')
    expect(toDatetimeLocalValue(new Date('2026-07-05T06:30:00Z'))).toBe('2026-07-05T08:30')
  })

  it('pads single-digit month, day, hour and minute', () => {
    expect(toDatetimeLocalValue(new Date('2026-01-02T03:05:00Z'))).toBe('2026-01-02T04:05')
  })
})

describe('fromDatetimeLocalValue', () => {
  it('reads the typed value as Paris time', () => {
    expect(fromDatetimeLocalValue('2026-03-05T08:30').toISOString()).toBe('2026-03-05T07:30:00.000Z')
    expect(fromDatetimeLocalValue('2026-07-05T08:30').toISOString()).toBe('2026-07-05T06:30:00.000Z')
  })

  it('round-trips with toDatetimeLocalValue', () => {
    expect(toDatetimeLocalValue(fromDatetimeLocalValue('2026-10-25T14:05'))).toBe('2026-10-25T14:05')
  })
})
