import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { useEntriesInRange } from './useEntriesInRange'

const subscribeToFeedingEntriesInRange = vi.fn()
const subscribeToSleepEntriesInRange = vi.fn()
const subscribeToDiaperEntriesInRange = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  subscribeToFeedingEntriesInRange: (...args: unknown[]) => subscribeToFeedingEntriesInRange(...args),
}))
vi.mock('../repositories/sleepEntries', () => ({
  subscribeToSleepEntriesInRange: (...args: unknown[]) => subscribeToSleepEntriesInRange(...args),
}))
vi.mock('../repositories/diaperEntries', () => ({
  subscribeToDiaperEntriesInRange: (...args: unknown[]) => subscribeToDiaperEntriesInRange(...args),
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
  type: 'pee',
  occurredAt: '2026-03-05T07:00:00.000Z',
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T07:00:00.000Z',
}

const range = dayRange(new Date('2026-03-05T12:00:00.000Z'))

describe('useEntriesInRange', () => {
  beforeEach(() => {
    subscribeToFeedingEntriesInRange.mockReset()
    subscribeToSleepEntriesInRange.mockReset()
    subscribeToDiaperEntriesInRange.mockReset()
  })

  it('returns empty arrays without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useEntriesInRange(null, null, range))

    expect(result.current).toEqual({ feeding: [], sleep: [], diaper: [] })
    expect(subscribeToFeedingEntriesInRange).not.toHaveBeenCalled()
  })

  it('subscribes to all three collections and reflects their entries', () => {
    subscribeToFeedingEntriesInRange.mockImplementation((_h, _b, _r, onChange) => {
      onChange([feeding])
      return vi.fn()
    })
    subscribeToSleepEntriesInRange.mockImplementation((_h, _b, _r, onChange) => {
      onChange([sleep])
      return vi.fn()
    })
    subscribeToDiaperEntriesInRange.mockImplementation((_h, _b, _r, onChange) => {
      onChange([diaper])
      return vi.fn()
    })

    const { result } = renderHook(() => useEntriesInRange('h1', 'b1', range))

    expect(result.current).toEqual({ feeding: [feeding], sleep: [sleep], diaper: [diaper] })
  })

  it('unsubscribes all three subscriptions on unmount', () => {
    const unsubscribeFeeding = vi.fn()
    const unsubscribeSleep = vi.fn()
    const unsubscribeDiaper = vi.fn()
    subscribeToFeedingEntriesInRange.mockReturnValue(unsubscribeFeeding)
    subscribeToSleepEntriesInRange.mockReturnValue(unsubscribeSleep)
    subscribeToDiaperEntriesInRange.mockReturnValue(unsubscribeDiaper)

    const { unmount } = renderHook(() => useEntriesInRange('h1', 'b1', range))
    unmount()

    expect(unsubscribeFeeding).toHaveBeenCalled()
    expect(unsubscribeSleep).toHaveBeenCalled()
    expect(unsubscribeDiaper).toHaveBeenCalled()
  })
})
