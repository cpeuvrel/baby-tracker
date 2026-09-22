import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecentEntries } from './useRecentEntries'

describe('useRecentEntries', () => {
  const subscribe = vi.fn()

  beforeEach(() => {
    subscribe.mockReset()
  })

  it('returns an empty list without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useRecentEntries(subscribe, null, 'b1', 5))

    expect(result.current).toEqual([])
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('subscribes with the given count and reflects the entries', () => {
    subscribe.mockImplementation((_h, _b, _count, onChange) => {
      onChange(['a', 'b'])
      return vi.fn()
    })

    const { result } = renderHook(() => useRecentEntries(subscribe, 'h1', 'b1', 5))

    expect(subscribe).toHaveBeenCalledWith('h1', 'b1', 5, expect.any(Function))
    expect(result.current).toEqual(['a', 'b'])
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    subscribe.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useRecentEntries(subscribe, 'h1', 'b1', 5))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
