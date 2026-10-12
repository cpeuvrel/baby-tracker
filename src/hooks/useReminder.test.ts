import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Reminder } from '../types/models'
import { useReminder, useReminderState } from './useReminder'

const subscribeToReminder = vi.fn()

vi.mock('../repositories/reminders', () => ({
  subscribeToReminder: (...args: unknown[]) => subscribeToReminder(...args),
}))

describe('useReminder', () => {
  beforeEach(() => {
    subscribeToReminder.mockReset()
  })

  it('returns null without subscribing when household or baby is missing', () => {
    const { result } = renderHook(() => useReminder(null, 'b1', 'Vitamine D'))

    expect(result.current).toBeNull()
    expect(subscribeToReminder).not.toHaveBeenCalled()
  })

  it('subscribes with the given medication name and reflects the reminder', () => {
    const reminder: Reminder = { id: 'Vitamine D', medicationName: 'Vitamine D', timeOfDay: '09:00', active: true }
    subscribeToReminder.mockImplementation((_h, _b, _name, onChange) => {
      onChange(reminder)
      return vi.fn()
    })

    const { result } = renderHook(() => useReminder('h1', 'b1', 'Vitamine D'))

    expect(subscribeToReminder).toHaveBeenCalledWith(
      'h1',
      'b1',
      'Vitamine D',
      expect.any(Function),
      expect.any(Function),
    )
    expect(result.current).toEqual(reminder)
  })

  it('tells "loading" from "no reminder yet", and reports a listener error', () => {
    const listeners: Array<{ onChange: (r: Reminder | null) => void; onError: (e: Error) => void }> = []
    subscribeToReminder.mockImplementation((_h, _b, _name, onChange, onError) => {
      listeners.push({ onChange, onError })
      return vi.fn()
    })

    const { result } = renderHook(() => useReminderState('h1', 'b1', 'Vitamine D'))
    expect(result.current).toEqual({ reminder: null, loading: true, error: null })

    act(() => listeners[0].onChange(null))
    expect(result.current).toEqual({ reminder: null, loading: false, error: null })

    act(() => listeners[0].onError(new Error('permission-denied')))
    expect(result.current).toEqual({ reminder: null, loading: false, error: new Error('permission-denied') })
  })

  it("does not show the previous baby's reminder after a switch", () => {
    const reminder: Reminder = { id: 'Vitamine D', medicationName: 'Vitamine D', timeOfDay: '09:00', active: true }
    subscribeToReminder.mockImplementation((_h, babyId, _name, onChange) => {
      if (babyId === 'b1') onChange(reminder)
      return vi.fn()
    })

    const { result, rerender } = renderHook(({ babyId }) => useReminder('h1', babyId, 'Vitamine D'), {
      initialProps: { babyId: 'b1' },
    })
    expect(result.current).toEqual(reminder)

    rerender({ babyId: 'b2' })

    expect(result.current).toBeNull()
  })
})
