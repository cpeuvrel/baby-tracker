import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase/firestore'

const { disableNetwork, enableNetwork } = vi.hoisted(() => ({
  disableNetwork: vi.fn(() => Promise.resolve()),
  enableNetwork: vi.fn(() => Promise.resolve()),
}))
vi.mock('firebase/firestore', () => ({ disableNetwork, enableNetwork }))

import { RESYNC_AFTER_HIDDEN_MS, resyncFirestoreOnForeground } from './firestoreResync'

const db = {} as Firestore

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('resyncFirestoreOnForeground', () => {
  let stop: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    disableNetwork.mockClear()
    enableNetwork.mockClear()
    stop = resyncFirestoreOnForeground(db)
  })

  afterEach(() => {
    stop()
    setVisibility('visible')
    vi.useRealTimers()
  })

  it('reconnects when the app comes back after a while in the background', async () => {
    setVisibility('hidden')
    vi.advanceTimersByTime(RESYNC_AFTER_HIDDEN_MS)
    setVisibility('visible')
    await vi.waitFor(() => expect(enableNetwork).toHaveBeenCalledWith(db))

    expect(disableNetwork).toHaveBeenCalledWith(db)
  })

  it('leaves the connection alone after a short switch away', () => {
    setVisibility('hidden')
    vi.advanceTimersByTime(RESYNC_AFTER_HIDDEN_MS - 1)
    setVisibility('visible')

    expect(disableNetwork).not.toHaveBeenCalled()
  })

  it('stops listening once stopped', () => {
    stop()
    setVisibility('hidden')
    vi.advanceTimersByTime(RESYNC_AFTER_HIDDEN_MS)
    setVisibility('visible')

    expect(disableNetwork).not.toHaveBeenCalled()
  })
})
