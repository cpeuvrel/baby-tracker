import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Reminder } from '../types/models'
import { useReminder } from './useReminder'

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

    expect(subscribeToReminder).toHaveBeenCalledWith('h1', 'b1', 'Vitamine D', expect.any(Function))
    expect(result.current).toEqual(reminder)
  })
})
