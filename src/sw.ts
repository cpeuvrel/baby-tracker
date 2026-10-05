/// <reference lib="webworker" />
// Single service worker: PWA installability (Workbox precache) + push
// notifications (medication reminder, plan section 8). Excluded from the main
// project's typecheck (tsconfig.app.json) — DOM and WebWorker have incompatible
// types; esbuild (vite-plugin-pwa) bundles it without type checking, like the
// other Vite/Workbox service workers.
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import {
  SLEEP_TIMER_NOTIFICATION_TAG,
  SLEEP_TIMER_PUSH,
  SLEEP_TIMER_STOP_PUSH,
  SLEEP_TIMER_TITLE,
  sleepTimerNotificationOptions,
} from './lib/sleepTimerNotification'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

const app = initializeApp({
  apiKey: 'AIzaSyBzK1s_hGiGWTKTshq9aeA4n666h4BNsTM',
  authDomain: 'baby-tracker-c8fd2.firebaseapp.com',
  projectId: 'baby-tracker-c8fd2',
  storageBucket: 'baby-tracker-c8fd2.firebasestorage.app',
  messagingSenderId: '190686938915',
  appId: '1:190686938915:web:408311f3102c5fe8f52e96',
})

const messaging = getMessaging(app)

onBackgroundMessage(messaging, async (payload) => {
  // Sleep timer pushes (functions/src/sleepTimer.ts): the server sends one a
  // minute while a sleep runs, so the elapsed time stays current with the app
  // in the background. The text is computed here, so a late push is still right.
  const data = payload.data ?? {}
  if (data.type === SLEEP_TIMER_PUSH && data.babyName && data.startedAt) {
    await self.registration.showNotification(
      SLEEP_TIMER_TITLE,
      sleepTimerNotificationOptions(data.babyName, new Date(data.startedAt), new Date()),
    )
    return
  }
  if (data.type === SLEEP_TIMER_STOP_PUSH) {
    const notifications = await self.registration.getNotifications({ tag: SLEEP_TIMER_NOTIFICATION_TAG })
    notifications.forEach((notification) => notification.close())
    return
  }

  const title = payload.notification?.title ?? 'Baby Tracker'
  const body = payload.notification?.body ?? ''
  await self.registration.showNotification(title, { body, icon: '/icon-192.png', badge: '/badge-96.png' })
})

// A tap on a notification (the running sleep timer) opens its screen in the
// app: an open window is focused and routes there itself (no reload), else the
// app launches on it. The timer notification stays until the timer stops.
self.addEventListener('notificationclick', (event) => {
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/'
  if (event.notification.tag !== SLEEP_TIMER_NOTIFICATION_TAG) event.notification.close()
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
