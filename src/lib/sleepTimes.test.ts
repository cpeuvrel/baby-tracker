import { describe, expect, it } from 'vitest'
import { withDuration, withEnd, withStart } from './sleepTimes'

const empty = { start: '', end: '', duration: null }

describe('sleep times', () => {
  describe('with no duration', () => {
    it('computes the duration from a start then an end', () => {
      const times = withEnd(withStart(empty, '2026-03-05T20:00'), '2026-03-05T21:30')
      expect(times).toEqual({ start: '2026-03-05T20:00', end: '2026-03-05T21:30', duration: 90 })
    })

    it('computes the end from a start then a duration', () => {
      const times = withDuration(withStart(empty, '2026-03-05T20:00'), 45)
      expect(times).toEqual({ start: '2026-03-05T20:00', end: '2026-03-05T20:45', duration: 45 })
    })
  })

  describe('with a duration', () => {
    it('fills an empty end when the start is set', () => {
      expect(withStart({ ...empty, duration: 30 }, '2026-03-05T23:50')).toEqual({
        start: '2026-03-05T23:50',
        end: '2026-03-06T00:20',
        duration: 30,
      })
    })

    it('adapts the duration when the start moves and the end is set', () => {
      const times = { start: '2026-03-06T01:00', end: '2026-03-06T03:50', duration: 170 }
      expect(withStart(times, '2026-03-06T02:40')).toEqual({ ...times, start: '2026-03-06T02:40', duration: 70 })
    })

    it('fills an empty start when the end is set', () => {
      expect(withEnd({ ...empty, duration: 30 }, '2026-03-05T21:00')).toEqual({
        start: '2026-03-05T20:30',
        end: '2026-03-05T21:00',
        duration: 30,
      })
    })

    it('adapts the duration when the end moves and the start is set', () => {
      const times = { start: '2026-03-05T20:00', end: '2026-03-05T21:00', duration: 60 }
      expect(withEnd(times, '2026-03-05T21:15')).toEqual({ ...times, end: '2026-03-05T21:15', duration: 75 })
    })

    it('moves the end, not the start, when the duration changes', () => {
      const times = { start: '2026-03-05T20:00', end: '2026-03-05T21:00', duration: 60 }
      expect(withDuration(times, 20)).toEqual({ ...times, end: '2026-03-05T20:20', duration: 20 })
    })
  })

  it('shows no duration while the end comes before the start', () => {
    const times = { start: '2026-03-05T20:00', end: '2026-03-05T21:00', duration: 60 }
    expect(withStart(times, '2026-03-05T22:00').duration).toBeNull()
  })
})
