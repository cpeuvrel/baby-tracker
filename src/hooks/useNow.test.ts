import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-05T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current time', () => {
    const { result } = renderHook(() => useNow())

    expect(result.current.toISOString()).toBe('2026-03-05T10:00:00.000Z')
  })

  it('refreshes on every interval', () => {
    const { result } = renderHook(() => useNow(30_000))

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(result.current.toISOString()).toBe('2026-03-05T10:00:30.000Z')
  })

  it('refreshes when the page becomes visible again', () => {
    const { result } = renderHook(() => useNow(30_000))

    act(() => {
      // Timers were paused in the background: the clock moved, the interval didn't fire.
      vi.setSystemTime(new Date('2026-03-05T12:00:00.000Z'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.toISOString()).toBe('2026-03-05T12:00:00.000Z')
  })
})
