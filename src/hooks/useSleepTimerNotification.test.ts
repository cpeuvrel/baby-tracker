import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockHousehold } from '../test/mockContexts'
import type { SleepEntry } from '../types/models'
import { CLOSE_DELAY_MS, useSleepTimerBabyParam, useSleepTimerNotification } from './useSleepTimerNotification'

const showSleepTimerNotification = vi.fn()
const closeSleepTimerNotification = vi.fn()
const registerPush = vi.fn()

vi.mock('../lib/sleepTimerNotification', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sleepTimerNotification')>()),
  showSleepTimerNotification: (...args: unknown[]) => showSleepTimerNotification(...args),
  closeSleepTimerNotification: (...args: unknown[]) => closeSleepTimerNotification(...args),
}))
vi.mock('../lib/pushRegistration', () => ({ registerPush: (...args: unknown[]) => registerPush(...args) }))

const leo = { id: 'b1', name: 'Léo' }
const maelys = { id: 'b2', name: 'Maëlys' }
const sleep: SleepEntry = {
  id: 's1',
  startedAt: '2026-03-05T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T20:00:00.000Z',
}

describe('useSleepTimerNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    showSleepTimerNotification.mockReset().mockResolvedValue(undefined)
    closeSleepTimerNotification.mockReset().mockResolvedValue(undefined)
    registerPush.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows the running sleep in the baby's notification", () => {
    vi.stubGlobal('Notification', { permission: 'default' })

    renderHook(() => useSleepTimerNotification('uid1', leo, sleep))

    expect(showSleepTimerNotification).toHaveBeenCalledWith('b1', 'Léo', new Date(sleep.startedAt), expect.any(Date))
    expect(closeSleepTimerNotification).not.toHaveBeenCalled()
  })

  it('registers for the server pushes only once notifications are allowed', () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    const { unmount } = renderHook(() => useSleepTimerNotification('uid1', leo, sleep))
    expect(registerPush).not.toHaveBeenCalled()
    unmount()

    vi.stubGlobal('Notification', { permission: 'granted' })
    renderHook(() => useSleepTimerNotification('uid1', leo, sleep))
    expect(registerPush).toHaveBeenCalledWith('uid1')
  })

  it("closes the baby's notification a moment after its sleep stops", () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    const { rerender } = renderHook(({ entry }) => useSleepTimerNotification('uid1', leo, entry), {
      initialProps: { entry: sleep as SleepEntry | null },
    })

    rerender({ entry: null })
    vi.advanceTimersByTime(CLOSE_DELAY_MS - 1)
    expect(closeSleepTimerNotification).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(closeSleepTimerNotification).toHaveBeenCalledWith('b1')
  })

  it('does not close it when the sleep shows up within the delay (app opening)', () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    const { rerender } = renderHook(({ entry }) => useSleepTimerNotification('uid1', leo, entry), {
      initialProps: { entry: null as SleepEntry | null },
    })

    vi.advanceTimersByTime(CLOSE_DELAY_MS / 2)
    rerender({ entry: sleep })
    vi.advanceTimersByTime(CLOSE_DELAY_MS)

    expect(closeSleepTimerNotification).not.toHaveBeenCalled()
  })

  it("leaves a sleeping baby's notification alone when another child is picked", () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    const { rerender } = renderHook(({ baby, entry }) => useSleepTimerNotification('uid1', baby, entry), {
      initialProps: { baby: leo, entry: sleep as SleepEntry | null },
    })

    rerender({ baby: maelys, entry: null })
    vi.advanceTimersByTime(CLOSE_DELAY_MS)

    expect(closeSleepTimerNotification).toHaveBeenCalledTimes(1)
    expect(closeSleepTimerNotification).toHaveBeenCalledWith('b2')
  })
})

describe('useSleepTimerBabyParam', () => {
  const selectBaby = vi.fn()

  function renderAt(url: string, selectedBaby = leo) {
    mockHousehold({
      babies: [
        { ...leo, birthDate: '2025-06-01', sex: null },
        { ...maelys, birthDate: '2023-01-01', sex: null },
      ],
      selectedBaby: { ...selectedBaby, birthDate: '2025-06-01', sex: null },
      selectBaby,
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: [url] }, children)
    return renderHook(() => useSleepTimerBabyParam(), { wrapper })
  }

  beforeEach(() => {
    selectBaby.mockReset()
  })

  it("selects the notification's baby", () => {
    renderAt('/?timer=sleep&baby=b2')

    expect(selectBaby).toHaveBeenCalledWith('b2')
  })

  it('leaves the selection alone without a param, for the selected baby or an unknown one', () => {
    renderAt('/?timer=sleep')
    renderAt('/?timer=sleep&baby=b1')
    renderAt('/?timer=sleep&baby=nope')

    expect(selectBaby).not.toHaveBeenCalled()
  })
})
