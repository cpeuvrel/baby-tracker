import { describe, expect, it } from 'vitest'
import { formatDuration, secondsBetween } from './duration'

describe('secondsBetween', () => {
  it('computes whole seconds between two dates', () => {
    const start = new Date('2026-01-01T10:00:00Z')
    const end = new Date('2026-01-01T10:01:30Z')

    expect(secondsBetween(start, end)).toBe(90)
  })

  it('never returns a negative duration', () => {
    const start = new Date('2026-01-01T10:01:00Z')
    const end = new Date('2026-01-01T10:00:00Z')

    expect(secondsBetween(start, end)).toBe(0)
  })
})

describe('formatDuration', () => {
  it('formats seconds only under a minute', () => {
    expect(formatDuration(42)).toBe('42s')
  })

  it('formats minutes and seconds under an hour', () => {
    expect(formatDuration(125)).toBe('2min 05s')
  })

  it('formats hours and minutes at or above an hour', () => {
    expect(formatDuration(3725)).toBe('1h 02min')
  })
})
