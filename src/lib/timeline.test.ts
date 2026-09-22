import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { buildTimeline, dayRange } from './timeline'

describe('dayRange', () => {
  it('returns midnight to midnight for the reference date', () => {
    const { start, end } = dayRange(new Date('2026-03-05T14:30:00'))

    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

describe('buildTimeline', () => {
  const feeding: FeedingEntry = {
    id: 'f1',
    type: 'bottle',
    startedAt: '2026-03-05T08:00:00.000Z',
    endedAt: '2026-03-05T08:10:00.000Z',
    durationSeconds: 600,
    volumeMl: 120,
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
