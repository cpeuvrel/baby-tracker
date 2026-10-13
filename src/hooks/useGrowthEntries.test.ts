import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GrowthEntry } from '../types/models'
import { useGrowthEntries, useGrowthEntriesState } from './useGrowthEntries'

const subscribeToGrowthEntries = vi.fn()

vi.mock('../repositories/growthEntries', () => ({
  subscribeToGrowthEntries: (...args: unknown[]) => subscribeToGrowthEntries(...args),
}))

describe('useGrowthEntries', () => {
  beforeEach(() => {
    subscribeToGrowthEntries.mockReset()
  })

  it('returns an empty list without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useGrowthEntries(null, 'b1'))

    expect(result.current).toEqual([])
    expect(subscribeToGrowthEntries).not.toHaveBeenCalled()
  })

  it('subscribes and reflects growth entries once resolved', () => {
    const entry: GrowthEntry = {
      id: 'g1',
      measuredAt: '2026-02-01T10:00:00.000Z',
      weightG: 5800,
      heightMm: 590,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-02-01T10:00:00.000Z',
    }
    subscribeToGrowthEntries.mockImplementation((_h, _b, onChange) => {
      onChange([entry])
      return vi.fn()
    })

    const { result } = renderHook(() => useGrowthEntries('h1', 'b1'))

    expect(result.current).toEqual([entry])
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    subscribeToGrowthEntries.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useGrowthEntries('h1', 'b1'))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('loads until the first snapshot and reports a listener error', () => {
    let listener: { onChange: (e: GrowthEntry[]) => void; onError: (e: Error) => void } | undefined
    subscribeToGrowthEntries.mockImplementation((_h, _b, onChange, onError) => {
      listener = { onChange, onError }
      return vi.fn()
    })

    const { result } = renderHook(() => useGrowthEntriesState('h1', 'b1'))
    expect(result.current).toEqual({ entries: [], loading: true, error: null })

    act(() => listener?.onChange([]))
    expect(result.current).toEqual({ entries: [], loading: false, error: null })

    act(() => listener?.onError(new Error('permission-denied')))
    expect(result.current.error).toEqual(new Error('permission-denied'))
  })

  it("does not show the previous baby's measurements after a switch", () => {
    const entry: GrowthEntry = {
      id: 'g1',
      measuredAt: '2026-02-01T10:00:00.000Z',
      weightG: 5800,
      heightMm: null,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-02-01T10:00:00.000Z',
    }
    subscribeToGrowthEntries.mockImplementation((_h, babyId, onChange) => {
      if (babyId === 'b1') onChange([entry])
      return vi.fn()
    })

    const { result, rerender } = renderHook(({ babyId }) => useGrowthEntries('h1', babyId), {
      initialProps: { babyId: 'b1' },
    })
    expect(result.current).toEqual([entry])

    rerender({ babyId: 'b2' })

    expect(result.current).toEqual([])
  })
})
