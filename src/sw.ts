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

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'Baby Tracker'
  const body = payload.notification?.body ?? ''
  self.registration.showNotification(title, { body, icon: '/icon.svg' })
})
