import { createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

/** Navigations left to the network: Firebase's reserved /__/ paths (auth handler, init.json). */
export const NAVIGATION_DENYLIST = [/^\/__\//]

/**
 * Answers every page navigation with the precached app shell, so the installed app opens on any
 * route (/history, a visit from a notification…) while offline. Call it in the service worker
 * after `precacheAndRoute(self.__WB_MANIFEST)`: '/index.html' must already be precached.
 */
export function registerNavigationFallback(): void {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: NAVIGATION_DENYLIST }),
  )
}
