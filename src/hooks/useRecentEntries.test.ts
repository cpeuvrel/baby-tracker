import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecentEntries, useRecentEntriesState } from './useRecentEntries'

type OnChange = (entries: string[]) => void
type OnError = (error: Error) => void

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
    subscribe.mockImplementation((_h, _b, _count, onChange: OnChange) => {
      onChange(['a', 'b'])
      return vi.fn()
    })

    const { result } = renderHook(() => useRecentEntries(subscribe, 'h1', 'b1', 5))

    expect(subscribe).toHaveBeenCalledWith('h1', 'b1', 5, expect.any(Function), expect.any(Function))
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

describe('useRecentEntriesState', () => {
  const subscribe = vi.fn()
  let listeners: Array<{ babyId: string; onChange: OnChange; onError: OnError; unsubscribe: () => void }>

  beforeEach(() => {
    listeners = []
    subscribe.mockReset().mockImplementation((_h, babyId: string, _count, onChange: OnChange, onError: OnError) => {
      const unsubscribe = vi.fn()
      listeners.push({ babyId, onChange, onError, unsubscribe })
      return unsubscribe
    })
  })

  it('is neither loading nor failed without a baby', () => {
    const { result } = renderHook(() => useRecentEntriesState(subscribe, 'h1', null, 5))

    expect(result.current).toEqual({ entries: [], loading: false, error: null })
  })

  it('loads until the first snapshot', () => {
    const { result } = renderHook(() => useRecentEntriesState(subscribe, 'h1', 'b1', 5))

    expect(result.current).toEqual({ entries: [], loading: true, error: null })

    act(() => listeners[0].onChange(['a']))

    expect(result.current).toEqual({ entries: ['a'], loading: false, error: null })
  })

  it('reports a listener error, keeping the entries last received', () => {
    const { result } = renderHook(() => useRecentEntriesState(subscribe, 'h1', 'b1', 5))
    act(() => listeners[0].onChange(['a']))

    act(() => listeners[0].onError(new Error('permission-denied')))

    expect(result.current).toEqual({ entries: ['a'], loading: false, error: new Error('permission-denied') })
  })

  it('reports an error received before any snapshot', () => {
    const { result } = renderHook(() => useRecentEntriesState(subscribe, 'h1', 'b1', 5))

    act(() => listeners[0].onError(new Error('failed-precondition')))

    expect(result.current).toEqual({ entries: [], loading: false, error: new Error('failed-precondition') })
  })

  it("never shows the previous baby's entries after a switch", () => {
    const { result, rerender } = renderHook(({ babyId }) => useRecentEntriesState(subscribe, 'h1', babyId, 5), {
      initialProps: { babyId: 'b1' },
    })
    act(() => listeners[0].onChange(['from b1']))

    rerender({ babyId: 'b2' })

    expect(listeners[0].unsubscribe).toHaveBeenCalled()
    expect(result.current).toEqual({ entries: [], loading: true, error: null })

    // A late snapshot of the closed subscription is ignored.
    act(() => listeners[0].onChange(['late from b1']))
    expect(result.current.entries).toEqual([])

    act(() => listeners[1].onChange(['from b2']))
    expect(listeners[1].babyId).toBe('b2')
    expect(result.current).toEqual({ entries: ['from b2'], loading: false, error: null })
  })
})
