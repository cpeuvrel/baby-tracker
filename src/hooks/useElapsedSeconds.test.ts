import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useElapsedSeconds } from './useElapsedSeconds'

describe('useElapsedSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 when there is no active start time', () => {
    const { result } = renderHook(() => useElapsedSeconds(null))

    expect(result.current).toBe(0)
  })

  it('computes elapsed seconds immediately from the start time', () => {
    const { result } = renderHook(() => useElapsedSeconds('2026-03-05T09:59:30.000Z'))

    expect(result.current).toBe(30)
  })

  it('ticks every second while active', () => {
    const { result } = renderHook(() => useElapsedSeconds('2026-03-05T10:00:00.000Z'))

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current).toBe(3)
  })

  it('resets to 0 when the start time is cleared', () => {
    const { result, rerender } = renderHook(({ startedAt }) => useElapsedSeconds(startedAt), {
      initialProps: { startedAt: '2026-03-05T09:59:00.000Z' as string | null },
    })

    expect(result.current).toBe(60)

    rerender({ startedAt: null })

    expect(result.current).toBe(0)
  })
})
