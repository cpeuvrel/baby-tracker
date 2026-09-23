import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useActivityVisibility } from './useActivityVisibility'

describe('useActivityVisibility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults every category to visible when nothing is stored', () => {
    const { result } = renderHook(() => useActivityVisibility())

    expect(result.current.isVisible('feeding')).toBe(true)
    expect(result.current.isVisible('sleep')).toBe(true)
    expect(result.current.isVisible('diaper')).toBe(true)
    expect(result.current.isVisible('growth')).toBe(true)
    expect(result.current.isVisible('medication')).toBe(true)
  })

  it('hides a category on toggle and persists it', () => {
    const { result } = renderHook(() => useActivityVisibility())

    act(() => {
      result.current.toggle('growth')
    })

    expect(result.current.isVisible('growth')).toBe(false)
    expect(JSON.parse(localStorage.getItem('baby-tracker:hiddenActivities') ?? '[]')).toEqual(['growth'])
  })

  it('shows a hidden category again on a second toggle', () => {
    const { result } = renderHook(() => useActivityVisibility())

    act(() => {
      result.current.toggle('growth')
    })
    act(() => {
      result.current.toggle('growth')
    })

    expect(result.current.isVisible('growth')).toBe(true)
    expect(localStorage.getItem('baby-tracker:hiddenActivities')).toBe('[]')
  })

  it('reads previously hidden categories from storage', () => {
    localStorage.setItem('baby-tracker:hiddenActivities', JSON.stringify(['sleep']))

    const { result } = renderHook(() => useActivityVisibility())

    expect(result.current.isVisible('sleep')).toBe(false)
    expect(result.current.isVisible('feeding')).toBe(true)
  })
})
