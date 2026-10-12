import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAsyncAction } from './useAsyncAction'

describe('useAsyncAction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is pending while the action runs, and succeeds without error', async () => {
    let finish!: () => void
    const { result } = renderHook(() => useAsyncAction())

    let outcome!: Promise<boolean>
    act(() => {
      outcome = result.current.run(() => new Promise<void>((resolve) => (finish = resolve)))
    })
    expect(result.current.pending).toBe(true)

    await act(async () => {
      finish()
      await outcome
    })
    await expect(outcome).resolves.toBe(true)
    expect(result.current.pending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('runs a second tap only once the first action is over', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAsyncAction())

    let second!: Promise<boolean>
    await act(async () => {
      const first = result.current.run(action)
      second = result.current.run(action)
      await first
    })

    await expect(second).resolves.toBe(false)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('describes a failure, and clears it on the next run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useAsyncAction('Could not add the child.'))

    let outcome!: boolean
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(new Error('permission-denied')))
    })
    expect(outcome).toBe(false)
    expect(result.current.error).toBe('Could not add the child.')
    expect(result.current.pending).toBe(false)

    await act(async () => {
      await result.current.run(() => Promise.resolve())
    })
    expect(result.current.error).toBeNull()
  })
})
