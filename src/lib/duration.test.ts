import { describe, expect, it } from 'vitest'
import { formatDuration, formatRelativeTime, secondsBetween } from './duration'

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
    expect(formatDuration(125)).toBe('2m 05s')
  })

  it('formats hours and minutes at or above an hour', () => {
    expect(formatDuration(3725)).toBe('1h 02m')
  })

  it('formats days and hours at or above 24h', () => {
    expect(formatDuration(90000)).toBe('1d 01h')
  })

  it('treats exactly 24h as 1 day', () => {
    expect(formatDuration(86400)).toBe('1d 00h')
  })
})

describe('formatRelativeTime', () => {
  it('reports "just now" for anything under a minute', () => {
    const now = new Date('2026-03-05T10:00:30Z')
    expect(formatRelativeTime(new Date('2026-03-05T10:00:00Z'), now)).toBe('just now')
  })

  it('formats minutes only under an hour', () => {
    const now = new Date('2026-03-05T10:25:00Z')
    expect(formatRelativeTime(new Date('2026-03-05T10:00:00Z'), now)).toBe('25m ago')
  })

  it('formats hours and minutes at or above an hour', () => {
    const now = new Date('2026-03-05T12:10:00Z')
    expect(formatRelativeTime(new Date('2026-03-05T10:00:00Z'), now)).toBe('2h 10m ago')
  })

  it('formats days only at or above 24h, ignoring the remaining hours', () => {
    const now = new Date('2026-09-22T12:00:00Z')
    expect(formatRelativeTime(new Date('2026-03-18T14:50:21Z'), now)).toBe('187d ago')
  })
})
