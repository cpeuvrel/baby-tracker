import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { useDayTimeline } from './useDayTimeline'

const useEntriesInRange = vi.fn()

vi.mock('./useEntriesInRange', () => ({
  useEntriesInRange: (...args: unknown[]) => useEntriesInRange(...args),
}))

const feeding: FeedingEntry = {
  id: 'f1',
  type: 'solid',
  occurredAt: '2026-03-05T08:00:00.000Z',
  volumeMl: null,
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
const medication: MedicationEntry = {
  id: 'm1',
  name: 'Vitamin D',
  givenAt: '2026-03-05T06:00:00.000Z',
  dose: '2 drops',
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T06:00:00.000Z',
}

describe('useDayTimeline', () => {
  beforeEach(() => {
    useEntriesInRange.mockReset()
  })

  it('merges entries for the given reference date into a timeline', () => {
    useEntriesInRange.mockReturnValue({
      feeding: [feeding],
      sleep: [sleep],
      diaper: [diaper],
      medication: [medication],
      bath: [],
    })

    const { result } = renderHook(() =>
      useDayTimeline('h1', 'b1', new Date('2026-03-05T12:00:00.000Z')),
    )

    expect(result.current.timeline.map((item) => item.kind)).toEqual(['sleep', 'feeding', 'diaper', 'medication'])
  })

  it('loads from the day before, listing only the day but keeping last night for the total', () => {
    // 21:00 (Paris) on the 4th → 06:00 on the 5th, and a 21:00 bottle on the 4th.
    const lastNight: SleepEntry = {
      ...sleep,
      id: 's0',
      startedAt: '2026-03-04T20:00:00.000Z',
      endedAt: '2026-03-05T05:00:00.000Z',
    }
    const eveningBottle: FeedingEntry = { ...feeding, id: 'f0', occurredAt: '2026-03-04T20:00:00.000Z' }
    useEntriesInRange.mockReturnValue({
      feeding: [eveningBottle, feeding],
      sleep: [lastNight, sleep],
      diaper: [],
      medication: [],
      bath: [],
    })

    const { result } = renderHook(() => useDayTimeline('h1', 'b1', new Date('2026-03-05T12:00:00.000Z')))

    expect(result.current.timeline.map((item) => item.entry.id)).toEqual(['s1', 'f1'])
    expect(result.current.sleep.map((entry) => entry.id)).toEqual(['s0', 's1'])
  })

  it('requests the reference day and the day before', () => {
    useEntriesInRange.mockReturnValue({ feeding: [], sleep: [], diaper: [], medication: [], bath: [] })
    const reference = new Date('2026-03-04T15:00:00.000Z')

    renderHook(() => useDayTimeline('h1', 'b1', reference))

    const rangeArg = useEntriesInRange.mock.calls[0][2]
    // Paris day of 2026-03-04 16:00 and the one before: from 2026-03-03 00:00 to 2026-03-05 00:00 (UTC+1)
    expect(rangeArg.start.toISOString()).toBe('2026-03-02T23:00:00.000Z')
    expect(rangeArg.end.toISOString()).toBe('2026-03-04T23:00:00.000Z')
  })
})
