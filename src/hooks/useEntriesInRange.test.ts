import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dayRange } from '../lib/timeline'
import type { BathEntry, DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { useEntriesInRange, useEntriesInRangeState } from './useEntriesInRange'

const subscribeToFeedingEntriesInRange = vi.fn()
const subscribeToSleepEntriesInRange = vi.fn()
const subscribeToDiaperEntriesInRange = vi.fn()
const subscribeToMedicationEntriesInRange = vi.fn()
const subscribeToBathEntriesInRange = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  subscribeToFeedingEntriesInRange: (...args: unknown[]) => subscribeToFeedingEntriesInRange(...args),
}))
vi.mock('../repositories/sleepEntries', () => ({
  subscribeToSleepEntriesInRange: (...args: unknown[]) => subscribeToSleepEntriesInRange(...args),
}))
vi.mock('../repositories/diaperEntries', () => ({
  subscribeToDiaperEntriesInRange: (...args: unknown[]) => subscribeToDiaperEntriesInRange(...args),
}))
vi.mock('../repositories/bathEntries', () => ({
  subscribeToBathEntriesInRange: (...args: unknown[]) => subscribeToBathEntriesInRange(...args),
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

const bath: BathEntry = {
  id: 'b1',
  occurredAt: '2026-03-05T18:30:00.000Z',
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T18:30:00.000Z',
}

const range = dayRange(new Date('2026-03-05T12:00:00.000Z'))

describe('useEntriesInRange', () => {
  beforeEach(() => {
    subscribeToFeedingEntriesInRange.mockReset()
    subscribeToSleepEntriesInRange.mockReset()
    subscribeToDiaperEntriesInRange.mockReset()
    subscribeToMedicationEntriesInRange.mockReset()
    subscribeToBathEntriesInRange.mockReset()
  })

  it('returns empty arrays without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useEntriesInRangeState(null, null, range))

    expect(result.current).toEqual({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
      bath: [],
      loading: false,
      error: null,
    })
    expect(subscribeToFeedingEntriesInRange).not.toHaveBeenCalled()
  })

  it('subscribes to all five collections and reflects their entries', () => {
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
    subscribeToBathEntriesInRange.mockImplementation((_h, _b, _r, onChange) => {
      onChange([bath])
      return vi.fn()
    })

    const { result } = renderHook(() => useEntriesInRange('h1', 'b1', range))

    expect(result.current).toMatchObject({
      feeding: [feeding],
      sleep: [sleep],
      diaper: [diaper],
      medication: [medication],
      bath: [bath],
      loading: false,
      error: null,
    })
    expect(subscribeToFeedingEntriesInRange).toHaveBeenCalledWith(
      'h1',
      'b1',
      range,
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('unsubscribes all five subscriptions on unmount', () => {
    const unsubscribeFeeding = vi.fn()
    const unsubscribeSleep = vi.fn()
    const unsubscribeDiaper = vi.fn()
    const unsubscribeMedication = vi.fn()
    subscribeToFeedingEntriesInRange.mockReturnValue(unsubscribeFeeding)
    subscribeToSleepEntriesInRange.mockReturnValue(unsubscribeSleep)
    subscribeToDiaperEntriesInRange.mockReturnValue(unsubscribeDiaper)
    subscribeToMedicationEntriesInRange.mockReturnValue(unsubscribeMedication)
    const unsubscribeBath = vi.fn()
    subscribeToBathEntriesInRange.mockReturnValue(unsubscribeBath)

    const { unmount } = renderHook(() => useEntriesInRange('h1', 'b1', range))
    unmount()

    expect(unsubscribeFeeding).toHaveBeenCalled()
    expect(unsubscribeSleep).toHaveBeenCalled()
    expect(unsubscribeDiaper).toHaveBeenCalled()
    expect(unsubscribeMedication).toHaveBeenCalled()
    expect(unsubscribeBath).toHaveBeenCalled()
  })

  describe('loading, errors and baby switch', () => {
    type Listener = { babyId: string; onChange: (entries: unknown[]) => void; onError: (error: Error) => void }
    let listeners: Record<string, Listener[]>

    beforeEach(() => {
      listeners = { feeding: [], sleep: [], diaper: [], medication: [], bath: [] }
      const capture = (name: string) => (_h: string, babyId: string, _r: unknown, onChange: Listener['onChange'], onError: Listener['onError']) => {
        listeners[name].push({ babyId, onChange, onError })
        return vi.fn()
      }
      subscribeToFeedingEntriesInRange.mockImplementation(capture('feeding'))
      subscribeToSleepEntriesInRange.mockImplementation(capture('sleep'))
      subscribeToDiaperEntriesInRange.mockImplementation(capture('diaper'))
      subscribeToMedicationEntriesInRange.mockImplementation(capture('medication'))
      subscribeToBathEntriesInRange.mockImplementation(capture('bath'))
    })

    const answerAll = (index: number) => {
      for (const name of Object.keys(listeners)) listeners[name][index].onChange([])
    }

    it('loads until every collection delivered its first snapshot', () => {
      const { result } = renderHook(() => useEntriesInRangeState('h1', 'b1', range))
      expect(result.current.loading).toBe(true)

      act(() => {
        listeners.feeding[0].onChange([feeding])
        listeners.sleep[0].onChange([])
        listeners.diaper[0].onChange([])
        listeners.medication[0].onChange([])
      })
      expect(result.current.loading).toBe(true)
      expect(result.current.feeding).toEqual([feeding])

      act(() => listeners.bath[0].onChange([bath]))
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('reports the error of a failed listener', () => {
      const { result } = renderHook(() => useEntriesInRangeState('h1', 'b1', range))
      act(() => answerAll(0))

      act(() => listeners.sleep[0].onError(new Error('permission-denied')))

      expect(result.current.error).toEqual(new Error('permission-denied'))
      expect(result.current.loading).toBe(false)
    })

    it("never shows the previous baby's entries after a switch", () => {
      const { result, rerender } = renderHook(({ babyId }) => useEntriesInRange('h1', babyId, range), {
        initialProps: { babyId: 'b1' },
      })
      act(() => {
        answerAll(0)
        listeners.feeding[0].onChange([feeding])
      })
      expect(result.current.feeding).toEqual([feeding])

      rerender({ babyId: 'b2' })

      expect(result.current.feeding).toEqual([])
      expect(listeners.feeding[1].babyId).toBe('b2')
      act(() => listeners.feeding[0].onChange([feeding]))
      expect(result.current.feeding).toEqual([])
    })
  })
})
