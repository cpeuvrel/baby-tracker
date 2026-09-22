import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { useTodayTimeline } from './useTodayTimeline'

const subscribeToTodayFeedingEntries = vi.fn()
const subscribeToTodaySleepEntries = vi.fn()
const subscribeToTodayDiaperEntries = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  subscribeToTodayFeedingEntries: (...args: unknown[]) => subscribeToTodayFeedingEntries(...args),
}))
vi.mock('../repositories/sleepEntries', () => ({
  subscribeToTodaySleepEntries: (...args: unknown[]) => subscribeToTodaySleepEntries(...args),
}))
vi.mock('../repositories/diaperEntries', () => ({
  subscribeToTodayDiaperEntries: (...args: unknown[]) => subscribeToTodayDiaperEntries(...args),
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
    subscribeToTodayFeedingEntries.mockReset()
    subscribeToTodaySleepEntries.mockReset()
    subscribeToTodayDiaperEntries.mockReset()
  })

  it('returns an empty timeline without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useTodayTimeline(null, null))

    expect(result.current).toEqual([])
    expect(subscribeToTodayFeedingEntries).not.toHaveBeenCalled()
  })

  it('merges feeding, sleep and diaper entries once all subscriptions resolve', () => {
    subscribeToTodayFeedingEntries.mockImplementation((_h, _b, _r, onChange) => {
      onChange([feeding])
      return vi.fn()
    })
    subscribeToTodaySleepEntries.mockImplementation((_h, _b, _r, onChange) => {
      onChange([sleep])
      return vi.fn()
    })
    subscribeToTodayDiaperEntries.mockImplementation((_h, _b, _r, onChange) => {
      onChange([diaper])
      return vi.fn()
    })

    const { result } = renderHook(() => useTodayTimeline('h1', 'b1'))

    expect(result.current.map((item) => item.kind)).toEqual(['sleep', 'feeding', 'diaper'])
  })

  it('unsubscribes all three subscriptions on unmount', () => {
    const unsubscribeFeeding = vi.fn()
    const unsubscribeSleep = vi.fn()
    const unsubscribeDiaper = vi.fn()
    subscribeToTodayFeedingEntries.mockReturnValue(unsubscribeFeeding)
    subscribeToTodaySleepEntries.mockReturnValue(unsubscribeSleep)
    subscribeToTodayDiaperEntries.mockReturnValue(unsubscribeDiaper)

    const { unmount } = renderHook(() => useTodayTimeline('h1', 'b1'))
    unmount()

    expect(unsubscribeFeeding).toHaveBeenCalled()
    expect(unsubscribeSleep).toHaveBeenCalled()
    expect(unsubscribeDiaper).toHaveBeenCalled()
  })
})
