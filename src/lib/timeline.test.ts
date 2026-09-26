import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import {
  activityWindowStart,
  buildTimeline,
  dayKey,
  dayKeysInRange,
  dayRange,
  isToday,
  isYesterday,
  lastNDayKeys,
  lastNDaysRange,
  nightDayKey,
  parseDayKey,
  precedingRange,
} from './timeline'

describe('dayRange', () => {
  it('returns midnight to midnight for the reference date', () => {
    const { start, end } = dayRange(new Date('2026-03-05T14:30:00+01:00'))

    expect(start.toISOString()).toBe('2026-03-04T23:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('uses Paris midnight even when the UTC date differs', () => {
    // 00:30 in Paris is still the previous day in UTC
    expect(dayRange(new Date('2026-07-01T22:30:00Z')).start.toISOString()).toBe('2026-07-01T22:00:00.000Z')
  })

  it('spans 23 hours on the spring daylight saving day', () => {
    const { start, end } = dayRange(new Date('2026-03-29T12:00:00+02:00'))
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000)
  })
})

describe('lastNDaysRange', () => {
  it('spans N full days ending at midnight after the reference date', () => {
    const { start, end } = lastNDaysRange(new Date('2026-03-05T14:30:00+01:00'), 7)

    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(end.toISOString()).toBe('2026-03-05T23:00:00.000Z')
  })
})

describe('dayKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(dayKey(new Date('2026-03-05T23:59:00+01:00'))).toBe('2026-03-05')
  })

  it('pads single-digit months and days', () => {
    expect(dayKey(new Date('2026-01-02T00:00:00+01:00'))).toBe('2026-01-02')
  })
})

describe('lastNDayKeys', () => {
  it('returns N day keys ending with the reference day, oldest first', () => {
    const keys = lastNDayKeys(new Date('2026-03-05T10:00:00+01:00'), 3)

    expect(keys).toEqual(['2026-03-03', '2026-03-04', '2026-03-05'])
  })
})

describe('parseDayKey', () => {
  it('parses a YYYY-MM-DD key as Paris midnight', () => {
    expect(parseDayKey('2026-03-05').toISOString()).toBe('2026-03-04T23:00:00.000Z')
    expect(parseDayKey('2026-07-05').toISOString()).toBe('2026-07-04T22:00:00.000Z')
  })
})

describe('nightDayKey', () => {
  it('counts times from the start of the night on the next day', () => {
    expect(nightDayKey(new Date('2026-03-05T19:59:00+01:00'), '20:00')).toBe('2026-03-05')
    expect(nightDayKey(new Date('2026-03-05T20:00:00+01:00'), '20:00')).toBe('2026-03-06')
    expect(nightDayKey(new Date('2026-03-06T03:00:00+01:00'), '20:00')).toBe('2026-03-06')
    expect(nightDayKey(new Date('2026-03-31T21:30:00+02:00'), '21:00')).toBe('2026-04-01')
  })
})

describe('activityWindowStart', () => {
  it('is yesterday at the start of the night, in Paris time', () => {
    const now = new Date('2026-03-05T17:03:00+01:00')

    expect(activityWindowStart(now, '20:00').toISOString()).toBe('2026-03-04T19:00:00.000Z')
  })

  it('stays on yesterday evening just after midnight', () => {
    const now = new Date('2026-03-05T00:10:00+01:00')

    expect(activityWindowStart(now, '19:30').toISOString()).toBe('2026-03-04T18:30:00.000Z')
  })
})

describe('isToday', () => {
  it('returns true for a timestamp on the same local day as now', () => {
    const now = new Date('2026-03-05T22:00:00+01:00')
    expect(isToday('2026-03-05T06:00:00+01:00', now)).toBe(true)
  })

  it('returns false for a timestamp on a different day', () => {
    const now = new Date('2026-03-05T06:00:00+01:00')
    expect(isToday('2026-03-04T23:59:00+01:00', now)).toBe(false)
  })
})

describe('isYesterday', () => {
  it('returns true for a timestamp on the day before now', () => {
    const now = new Date('2026-03-05T06:00:00+01:00')
    expect(isYesterday('2026-03-04T23:59:00+01:00', now)).toBe(true)
  })

  it('returns false for today or two days ago', () => {
    const now = new Date('2026-03-05T06:00:00+01:00')
    expect(isYesterday('2026-03-05T05:00:00+01:00', now)).toBe(false)
    expect(isYesterday('2026-03-03T23:59:00+01:00', now)).toBe(false)
  })
})

describe('dayKeysInRange', () => {
  it('lists every calendar day touched by the range', () => {
    const range = { start: new Date('2026-03-04T18:00:00+01:00'), end: new Date('2026-03-07T06:00:00+01:00') }

    expect(dayKeysInRange(range)).toEqual(['2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'])
  })

  it('returns a single key for a same-day range', () => {
    const range = dayRange(new Date('2026-03-05T14:00:00+01:00'))

    expect(dayKeysInRange(range)).toEqual(['2026-03-05'])
  })
})

describe('precedingRange', () => {
  it('returns the range of the same length immediately before', () => {
    const range = lastNDaysRange(new Date('2026-03-05T14:00:00+01:00'), 7)
    const preceding = precedingRange(range)

    expect(preceding.end.getTime()).toBe(range.start.getTime())
    expect(preceding.end.getTime() - preceding.start.getTime()).toBe(
      range.end.getTime() - range.start.getTime(),
    )
  })
})

describe('buildTimeline', () => {
  const feeding: FeedingEntry = {
    id: 'f1',
    type: 'bottle',
    occurredAt: '2026-03-05T08:00:00.000Z',
    volumeMl: 120,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T08:00:00.000Z',
  }
  const sleep: SleepEntry = {
    id: 's1',
    startedAt: '2026-03-05T09:00:00.000Z',
    endedAt: null,
    durationSeconds: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T09:00:00.000Z',
  }
  const diaper: DiaperEntry = {
    id: 'd1',
    type: 'wet',
    occurredAt: '2026-03-05T07:00:00.000Z',
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T07:00:00.000Z',
  }

  it('merges the three entry kinds sorted from most to least recent', () => {
    const timeline = buildTimeline([feeding], [sleep], [diaper])

    expect(timeline.map((item) => item.kind)).toEqual(['sleep', 'feeding', 'diaper'])
  })

  it('returns an empty list when there are no entries', () => {
    expect(buildTimeline([], [], [])).toEqual([])
  })
})
