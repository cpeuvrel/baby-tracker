import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { useEntriesInRange } from './useEntriesInRange'

const subscribeToFeedingEntriesInRange = vi.fn()
const subscribeToSleepEntriesInRange = vi.fn()
const subscribeToDiaperEntriesInRange = vi.fn()
const subscribeToMedicationEntriesInRange = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  subscribeToFeedingEntriesInRange: (...args: unknown[]) => subscribeToFeedingEntriesInRange(...args),
}))
vi.mock('../repositories/sleepEntries', () => ({
  subscribeToSleepEntriesInRange: (...args: unknown[]) => subscribeToSleepEntriesInRange(...args),
}))
vi.mock('../repositories/diaperEntries', () => ({
  subscribeToDiaperEntriesInRange: (...args: unknown[]) => subscribeToDiaperEntriesInRange(...args),
}))
vi.mock('../repositories/medicationEntries', () => ({
  subscribeToMedicationEntriesInRange: (...args: unknown[]) => subscribeToMedicationEntriesInRange(...args),
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
  givenAt: '2026-03-05T07:30:00.000Z',
  dose: '2 drops',
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T07:30:00.000Z',
}

const range = dayRange(new Date('2026-03-05T12:00:00.000Z'))

describe('useEntriesInRange', () => {
  beforeEach(() => {
    subscribeToFeedingEntriesInRange.mockReset()
    subscribeToSleepEntriesInRange.mockReset()
    subscribeToDiaperEntriesInRange.mockReset()
    subscribeToMedicationEntriesInRange.mockReset()
  })

  it('returns empty arrays without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useEntriesInRange(null, null, range))

    expect(result.current).toEqual({ feeding: [], sleep: [], diaper: [], medication: [] })
    expect(subscribeToFeedingEntriesInRange).not.toHaveBeenCalled()
  })

  it('subscribes to all four collections and reflects their entries', () => {
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
    subscribeToMedicationEntriesInRange.mockImplementation((_h, _b, _r, onChange) => {
      onChange([medication])
      return vi.fn()
    })

    const { result } = renderHook(() => useEntriesInRange('h1', 'b1', range))

    expect(result.current).toEqual({
      feeding: [feeding],
      sleep: [sleep],
      diaper: [diaper],
      medication: [medication],
    })
  })

  it('unsubscribes all four subscriptions on unmount', () => {
    const unsubscribeFeeding = vi.fn()
    const unsubscribeSleep = vi.fn()
    const unsubscribeDiaper = vi.fn()
    const unsubscribeMedication = vi.fn()
    subscribeToFeedingEntriesInRange.mockReturnValue(unsubscribeFeeding)
    subscribeToSleepEntriesInRange.mockReturnValue(unsubscribeSleep)
    subscribeToDiaperEntriesInRange.mockReturnValue(unsubscribeDiaper)
    subscribeToMedicationEntriesInRange.mockReturnValue(unsubscribeMedication)

    const { unmount } = renderHook(() => useEntriesInRange('h1', 'b1', range))
    unmount()

    expect(unsubscribeFeeding).toHaveBeenCalled()
    expect(unsubscribeSleep).toHaveBeenCalled()
    expect(unsubscribeDiaper).toHaveBeenCalled()
    expect(unsubscribeMedication).toHaveBeenCalled()
  })
})
