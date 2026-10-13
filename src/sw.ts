/// <reference lib="webworker" />
// Single service worker: PWA installability (Workbox precache) + the server's
// push notifications (sleep timer, medication and vaccine reminders).
// Type-checked by tsconfig.sw.json (WebWorker types, not DOM); bundled by
// vite-plugin-pwa, which also substitutes the `import.meta.env` values.
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerNavigationFallback } from './lib/swNavigation'
import { handleBackgroundPush } from './lib/backgroundPush'
import { firebaseConfig } from './lib/firebaseConfig'
import { isSleepTimerTag } from './lib/sleepTimerNotification'
import {
  VACCINE_BOUGHT_ACTION,
  VACCINE_NOT_BOUGHT_ACTION,
  type VaccineNotificationData,
} from './lib/vaccineNotification'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)
registerNavigationFallback()
self.skipWaiting()
clientsClaim()

const messaging = getMessaging(initializeApp(firebaseConfig))

// Every server push is data-only (functions/src/push.ts): the SDK shows
// nothing by itself and this handler draws (or closes) the notification.
onBackgroundMessage(messaging, (payload) => handleBackgroundPush(self.registration, payload.data ?? {}, new Date()))

// A tap on a notification (the running sleep timer, a vaccine reminder) opens
// its screen in the app: an open window is focused and routes there itself (no
// reload), else the app launches on it. The timer notification stays until the
// timer stops. On the vaccine question, "No" only dismisses it (it comes back
// tomorrow) and "Yes" opens the visit, which records the purchase.
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data as Partial<VaccineNotificationData> | null
  if (!isSleepTimerTag(event.notification.tag)) event.notification.close()
  if (event.action === VACCINE_NOT_BOUGHT_ACTION) return
  const url = (event.action === VACCINE_BOUGHT_ACTION ? data?.boughtUrl : data?.url) ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = windows.find((candidate) => new URL(candidate.url).origin === self.location.origin)
      if (client) {
        await client.focus()
        client.postMessage({ type: 'navigate', url })
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
