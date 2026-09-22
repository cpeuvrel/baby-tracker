import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedingEntry } from '../types/models'
import { useActiveBottleFeeding } from './useActiveBottleFeeding'

const subscribeToActiveBottleFeeding = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  subscribeToActiveBottleFeeding: (...args: unknown[]) => subscribeToActiveBottleFeeding(...args),
}))

describe('useActiveBottleFeeding', () => {
  beforeEach(() => {
    subscribeToActiveBottleFeeding.mockReset()
  })

  it('returns null without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useActiveBottleFeeding('h1', null))

    expect(result.current).toBeNull()
    expect(subscribeToActiveBottleFeeding).not.toHaveBeenCalled()
  })

  it('subscribes and reflects the active bottle entry once resolved', () => {
    const entry: FeedingEntry = {
      id: 'e1',
      type: 'bottle',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      volumeMl: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }
    subscribeToActiveBottleFeeding.mockImplementation(
      (_h: string, _b: string, onChange: (e: FeedingEntry | null) => void) => {
        onChange(entry)
        return vi.fn()
      },
    )

    const { result } = renderHook(() => useActiveBottleFeeding('h1', 'b1'))

    expect(result.current).toEqual(entry)
  })
})
