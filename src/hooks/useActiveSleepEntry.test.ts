import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepEntry } from '../types/models'
import { useActiveSleepEntries, useActiveSleepEntriesState, useActiveSleepEntry } from './useActiveSleepEntry'

const subscribeToActiveSleeps = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  subscribeToActiveSleeps: (...args: unknown[]) => subscribeToActiveSleeps(...args),
}))

describe('useActiveSleepEntry', () => {
  beforeEach(() => {
    subscribeToActiveSleeps.mockReset()
  })

  it('returns null without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useActiveSleepEntry(null, null))

    expect(result.current).toBeNull()
    expect(subscribeToActiveSleeps).not.toHaveBeenCalled()
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
    subscribeToActiveSleeps.mockImplementation(
      (_h: string, _b: string, onChange: (e: SleepEntry[]) => void) => {
        onChange([entry])
        return vi.fn()
      },
    )

    const { result } = renderHook(() => useActiveSleepEntry('h1', 'b1'))

    expect(subscribeToActiveSleeps).toHaveBeenCalledWith('h1', 'b1', expect.any(Function), expect.any(Function))
    expect(result.current).toEqual(entry)
  })

  it('lists every sleep running, the earliest being the active one', () => {
    const first: SleepEntry = {
      id: 'e1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }
    const second: SleepEntry = { ...first, id: 'e2', startedAt: '2026-03-05T10:02:00.000Z' }
    subscribeToActiveSleeps.mockImplementation(
      (_h: string, _b: string, onChange: (e: SleepEntry[]) => void) => {
        onChange([first, second])
        return vi.fn()
      },
    )

    expect(renderHook(() => useActiveSleepEntries('h1', 'b1')).result.current).toEqual([first, second])
    expect(renderHook(() => useActiveSleepEntry('h1', 'b1')).result.current).toEqual(first)
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    subscribeToActiveSleeps.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useActiveSleepEntry('h1', 'b1'))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('reports loading, then a listener error', () => {
    let onError: (error: Error) => void = () => {}
    subscribeToActiveSleeps.mockImplementation(
      (_h: string, _b: string, _onChange: unknown, error: (e: Error) => void) => {
        onError = error
        return vi.fn()
      },
    )

    const { result } = renderHook(() => useActiveSleepEntriesState('h1', 'b1'))
    expect(result.current).toEqual({ entries: [], loading: true, error: null })

    act(() => onError(new Error('permission-denied')))

    expect(result.current).toEqual({ entries: [], loading: false, error: new Error('permission-denied') })
  })

  it('announces no sleep for the new baby while its subscription loads', () => {
    const running: SleepEntry = {
      id: 'e1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }
    subscribeToActiveSleeps.mockImplementation((_h: string, babyId: string, onChange: (e: SleepEntry[]) => void) => {
      if (babyId === 'b1') onChange([running])
      return vi.fn()
    })

    const { result, rerender } = renderHook(({ babyId }) => useActiveSleepEntry('h1', babyId), {
      initialProps: { babyId: 'b1' },
    })
    expect(result.current).toEqual(running)

    rerender({ babyId: 'b2' })

    expect(result.current).toBeNull()
  })
})
