import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepEntry } from '../types/models'
import { useActiveSleepEntry } from './useActiveSleepEntry'

const subscribeToActiveSleep = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  subscribeToActiveSleep: (...args: unknown[]) => subscribeToActiveSleep(...args),
}))

describe('useActiveSleepEntry', () => {
  beforeEach(() => {
    subscribeToActiveSleep.mockReset()
  })

  it('returns null without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useActiveSleepEntry(null, null))

    expect(result.current).toBeNull()
    expect(subscribeToActiveSleep).not.toHaveBeenCalled()
  })

  it('subscribes and reflects the active entry once resolved', () => {
    const entry: SleepEntry = {
      id: 'e1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }
    subscribeToActiveSleep.mockImplementation(
      (_h: string, _b: string, onChange: (e: SleepEntry | null) => void) => {
        onChange(entry)
        return vi.fn()
      },
    )

    const { result } = renderHook(() => useActiveSleepEntry('h1', 'b1'))

    expect(subscribeToActiveSleep).toHaveBeenCalledWith('h1', 'b1', expect.any(Function))
    expect(result.current).toEqual(entry)
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    subscribeToActiveSleep.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useActiveSleepEntry('h1', 'b1'))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
