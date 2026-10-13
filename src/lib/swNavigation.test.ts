// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const workbox = vi.hoisted(() => ({
  registerRoute: vi.fn(),
  createHandlerBoundToURL: vi.fn((url: string) => ({ boundTo: url })),
  NavigationRoute: vi.fn(function (this: Record<string, unknown>, handler: unknown, options: unknown) {
    this.handler = handler
    this.options = options
  }),
}))

vi.mock('workbox-precaching', () => ({ createHandlerBoundToURL: workbox.createHandlerBoundToURL }))
vi.mock('workbox-routing', () => ({
  NavigationRoute: workbox.NavigationRoute,
  registerRoute: workbox.registerRoute,
}))

const { NAVIGATION_DENYLIST, registerNavigationFallback } = await import('./swNavigation')

describe('registerNavigationFallback', () => {
  it('serves the precached index.html for navigations outside the denylist', () => {
    registerNavigationFallback()

    expect(workbox.createHandlerBoundToURL).toHaveBeenCalledWith('/index.html')
    expect(workbox.registerRoute).toHaveBeenCalledWith({
      handler: { boundTo: '/index.html' },
      options: { denylist: NAVIGATION_DENYLIST },
    })
  })

  it('leaves the Firebase reserved paths to the network, not the app routes', () => {
    const denied = (path: string) => NAVIGATION_DENYLIST.some((pattern) => pattern.test(path))

    expect(denied('/__/auth/handler')).toBe(true)
    expect(denied('/__/firebase/init.json')).toBe(true)
    expect(denied('/')).toBe(false)
    expect(denied('/history')).toBe(false)
    expect(denied('/account/pediatrician/visits/abc')).toBe(false)
  })
})
