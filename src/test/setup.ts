import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'

// Guard: a unit test must never reach the real Firebase SDK (it would open network listeners and
// make the test depend on the machine). Anything that touches app/auth/db fails loudly: mock the
// repository or the hook instead. A test's own vi.mock('../lib/firebase', …) takes priority.
// Exception: the repository tests exercise the real firestore reference builders (collection(), doc())
// on the real `db`, which stays inert as the network functions (onSnapshot, getDocs, …) are mocked there.
vi.mock('../lib/firebase', async (importActual) => {
  if (/[\\/]src[\\/]repositories[\\/]/.test(expect.getState().testPath ?? '')) return importActual()
  const trap = (name: string) =>
    new Proxy(
      {},
      {
        get() {
          throw new Error(`${name} reached from a unit test: mock the repository or hook`)
        },
      },
    )
  return {
    app: trap('app'),
    auth: trap('auth'),
    db: trap('db'),
    usingEmulators: false,
    clearLocalDataAndReload: () => Promise.reject(new Error('clearLocalDataAndReload reached from a unit test')),
  }
})

afterEach(() => {
  cleanup()
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub
