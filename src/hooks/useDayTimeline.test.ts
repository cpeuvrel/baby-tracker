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
    })

    const { result } = renderHook(() =>
      useDayTimeline('h1', 'b1', new Date('2026-03-05T12:00:00.000Z')),
    )

    expect(result.current.map((item) => item.kind)).toEqual(['sleep', 'feeding', 'diaper', 'medication'])
  })

  it('requests the day range for the given reference date', () => {
    useEntriesInRange.mockReturnValue({ feeding: [], sleep: [], diaper: [], medication: [] })
    const reference = new Date('2026-03-04T15:00:00.000Z')

    renderHook(() => useDayTimeline('h1', 'b1', reference))

    expect(useEntriesInRange).toHaveBeenCalledWith(
      'h1',
      'b1',
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    )
    const rangeArg = useEntriesInRange.mock.calls[0][2]
    expect(rangeArg.start.getDate()).toBe(reference.getDate())
  })
})
