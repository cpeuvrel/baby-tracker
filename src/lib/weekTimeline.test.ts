import { describe, expect, it } from 'vitest'
import { rollingDayFrame } from './timeline'
import { buildWeekBlocks, buildWeekMarks, markForInstant, nightFractions, splitIntervalByDay } from './weekTimeline'

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

describe('rolling days', () => {
  // Windows from 12:00 to 12:00 (Paris).
  const frame = rollingDayFrame(new Date('2026-03-06T12:00:00+01:00'))

  it('splits an interval at the start of each window', () => {
    expect(
      splitIntervalByDay(new Date('2026-03-05T10:00:00+01:00'), new Date('2026-03-05T18:00:00+01:00'), frame),
    ).toEqual([
      { dayKey: '2026-03-05', startFraction: 22 / 24, endFraction: 1 },
      { dayKey: '2026-03-06', startFraction: 0, endFraction: 6 / 24 },
    ])
  })

  it('places an instant within its window', () => {
    expect(markForInstant(new Date('2026-03-06T06:00:00+01:00'), frame)).toEqual({
      dayKey: '2026-03-06',
      atFraction: 18 / 24,
    })
  })

  it('shifts the night bands to the start of the window', () => {
    expect(nightFractions({ start: '20:00', end: '08:00' }, 12 * 3600)).toEqual([{ start: 8 / 24, end: 20 / 24 }])
  })
})
