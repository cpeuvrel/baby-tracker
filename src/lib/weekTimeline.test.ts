import { describe, expect, it } from 'vitest'
import { buildWeekBlocks, buildWeekMarks, markForInstant, splitIntervalByDay } from './weekTimeline'

describe('splitIntervalByDay', () => {
  it('returns a single block for an interval within one day', () => {
    const blocks = splitIntervalByDay(
      new Date('2026-03-05T20:00:00+01:00'),
      new Date('2026-03-05T21:30:00+01:00'),
    )

    expect(blocks).toEqual([
      { dayKey: '2026-03-05', startFraction: 20 / 24, endFraction: 21.5 / 24 },
    ])
  })

  it('splits an interval spanning midnight into two blocks', () => {
    const blocks = splitIntervalByDay(
      new Date('2026-03-05T22:00:00+01:00'),
      new Date('2026-03-06T06:00:00+01:00'),
    )

    expect(blocks).toEqual([
      { dayKey: '2026-03-05', startFraction: 22 / 24, endFraction: 1 },
      { dayKey: '2026-03-06', startFraction: 0, endFraction: 6 / 24 },
    ])
  })

  it('splits an interval spanning multiple full days', () => {
    const blocks = splitIntervalByDay(
      new Date('2026-03-05T22:00:00+01:00'),
      new Date('2026-03-07T02:00:00+01:00'),
    )

    expect(blocks).toEqual([
      { dayKey: '2026-03-05', startFraction: 22 / 24, endFraction: 1 },
      { dayKey: '2026-03-06', startFraction: 0, endFraction: 1 },
      { dayKey: '2026-03-07', startFraction: 0, endFraction: 2 / 24 },
    ])
  })

  it('returns an empty array when end is not after start', () => {
    const same = new Date('2026-03-05T20:00:00+01:00')
    expect(splitIntervalByDay(same, same)).toEqual([])
  })
})

describe('markForInstant', () => {
  it('reports the day key and fraction of day for a timestamp', () => {
    expect(markForInstant(new Date('2026-03-05T06:00:00+01:00'))).toEqual({
      dayKey: '2026-03-05',
      atFraction: 0.25,
    })
  })
})

describe('buildWeekBlocks', () => {
  it('buckets intervals into their day, ignoring days outside the week', () => {
    const result = buildWeekBlocks(
      ['2026-03-04', '2026-03-05'],
      [
        { start: new Date('2026-03-05T20:00:00+01:00'), end: new Date('2026-03-05T21:00:00+01:00') },
        { start: new Date('2026-03-01T20:00:00+01:00'), end: new Date('2026-03-01T21:00:00+01:00') },
      ],
    )

    expect(result['2026-03-04']).toEqual([])
    expect(result['2026-03-05']).toHaveLength(1)
  })
})

describe('buildWeekMarks', () => {
  it('buckets instants into their day', () => {
    const result = buildWeekMarks(
      ['2026-03-05'],
      [new Date('2026-03-05T08:00:00+01:00'), new Date('2026-03-06T08:00:00+01:00')],
    )

    expect(result['2026-03-05']).toHaveLength(1)
  })
})
