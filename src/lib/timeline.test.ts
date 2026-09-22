import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { buildTimeline, dayKey, dayRange, lastNDayKeys, lastNDaysRange, parseDayKey } from './timeline'

describe('dayRange', () => {
  it('returns midnight to midnight for the reference date', () => {
    const { start, end } = dayRange(new Date('2026-03-05T14:30:00'))

    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

describe('lastNDaysRange', () => {
  it('spans N full days ending at midnight after the reference date', () => {
    const { start, end } = lastNDaysRange(new Date('2026-03-05T14:30:00'), 7)

    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(end.getHours()).toBe(0)
  })
})

describe('dayKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(dayKey(new Date('2026-03-05T23:59:00'))).toBe('2026-03-05')
  })

  it('pads single-digit months and days', () => {
    expect(dayKey(new Date('2026-01-02T00:00:00'))).toBe('2026-01-02')
  })
})

describe('lastNDayKeys', () => {
  it('returns N day keys ending with the reference day, oldest first', () => {
    const keys = lastNDayKeys(new Date('2026-03-05T10:00:00'), 3)

    expect(keys).toEqual(['2026-03-03', '2026-03-04', '2026-03-05'])
  })
})

describe('parseDayKey', () => {
  it('parses a YYYY-MM-DD key as a local midnight date', () => {
    const date = parseDayKey('2026-03-05')

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(5)
    expect(date.getHours()).toBe(0)
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
    type: 'pee',
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
