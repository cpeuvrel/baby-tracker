import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PediatricianVisit } from '../types/models'
import { usePediatricianVisits, usePediatricianVisitsState } from './usePediatricianVisits'

const subscribeToPediatricianVisits = vi.fn()

vi.mock('../repositories/pediatricianVisits', () => ({
  subscribeToPediatricianVisits: (...args: unknown[]) => subscribeToPediatricianVisits(...args),
}))

const visit: PediatricianVisit = {
  id: 'v1',
  date: '2026-10-08',
  vaccinated: false,
  vaccineBought: false,
  remarks: [],
  discussions: [],
  createdBy: 'uid1',
  createdAt: '2026-10-01T10:00:00.000Z',
}

type Listener = {
  babyId: string
  onChange: (visits: PediatricianVisit[]) => void
  onError: (error: Error) => void
}

describe('usePediatricianVisits', () => {
  let listeners: Listener[]

  beforeEach(() => {
    listeners = []
    subscribeToPediatricianVisits.mockReset().mockImplementation(
      (_h: string, babyId: string, onChange: Listener['onChange'], onError: Listener['onError']) => {
        listeners.push({ babyId, onChange, onError })
        return vi.fn()
      },
    )
  })

  it('returns no visits without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => usePediatricianVisitsState('h1', null))

    expect(result.current).toEqual({ visits: [], loading: false, error: null })
    expect(subscribeToPediatricianVisits).not.toHaveBeenCalled()
  })

  it('returns null until the first snapshot, then the visits', () => {
    const { result } = renderHook(() => usePediatricianVisits('h1', 'b1'))
    expect(result.current).toBeNull()

    act(() => listeners[0].onChange([visit]))

    expect(result.current).toEqual([visit])
  })

  it('reports a listener error instead of loading forever', () => {
    const { result } = renderHook(() => usePediatricianVisitsState('h1', 'b1'))
    expect(result.current).toEqual({ visits: null, loading: true, error: null })

    act(() => listeners[0].onError(new Error('permission-denied')))

    expect(result.current).toEqual({ visits: null, loading: false, error: new Error('permission-denied') })
  })

  it("ignores the previous baby's visits while the new subscription loads", () => {
    const { result, rerender } = renderHook(({ babyId }) => usePediatricianVisits('h1', babyId), {
      initialProps: { babyId: 'b1' },
    })
    act(() => listeners[0].onChange([visit]))

    rerender({ babyId: 'b2' })

    expect(result.current).toBeNull()
    act(() => listeners[1].onChange([]))
    expect(result.current).toEqual([])
  })
})
