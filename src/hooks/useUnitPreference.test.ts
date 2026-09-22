import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUnitPreference } from './useUnitPreference'

describe('useUnitPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to metric when nothing is stored', () => {
    const { result } = renderHook(() => useUnitPreference())

    expect(result.current[0]).toBe('metric')
  })

  it('reads a previously stored preference', () => {
    localStorage.setItem('baby-tracker:unitSystem', 'imperial')

    const { result } = renderHook(() => useUnitPreference())

    expect(result.current[0]).toBe('imperial')
  })

  it('updates the preference and persists it', () => {
    const { result } = renderHook(() => useUnitPreference())

    act(() => {
      result.current[1]('imperial')
    })

    expect(result.current[0]).toBe('imperial')
    expect(localStorage.getItem('baby-tracker:unitSystem')).toBe('imperial')
  })
})
