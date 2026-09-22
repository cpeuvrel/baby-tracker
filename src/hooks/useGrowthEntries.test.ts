import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GrowthEntry } from '../types/models'
import { useGrowthEntries } from './useGrowthEntries'

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
})
