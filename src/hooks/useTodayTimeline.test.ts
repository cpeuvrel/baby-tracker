import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { useTodayTimeline } from './useTodayTimeline'

const useEntriesInRange = vi.fn()

vi.mock('./useEntriesInRange', () => ({
  useEntriesInRange: (...args: unknown[]) => useEntriesInRange(...args),
}))

const feeding: FeedingEntry = {
  id: 'f1',
  type: 'solid',
  startedAt: '2026-03-05T08:00:00.000Z',
  endedAt: '2026-03-05T08:00:00.000Z',
  durationSeconds: 0,
  volumeMl: null,
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

describe('useTodayTimeline', () => {
  beforeEach(() => {
    useEntriesInRange.mockReset()
  })

  it('merges today entries into a timeline sorted most-recent first', () => {
    useEntriesInRange.mockReturnValue({ feeding: [feeding], sleep: [sleep], diaper: [diaper] })

    const { result } = renderHook(() => useTodayTimeline('h1', 'b1'))

    expect(result.current.map((item) => item.kind)).toEqual(['sleep', 'feeding', 'diaper'])
  })

  it('requests entries for the household, baby and today range', () => {
    useEntriesInRange.mockReturnValue({ feeding: [], sleep: [], diaper: [] })

    renderHook(() => useTodayTimeline('h1', 'b1'))

    expect(useEntriesInRange).toHaveBeenCalledWith(
      'h1',
      'b1',
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    )
  })
})
