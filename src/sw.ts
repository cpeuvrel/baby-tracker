/// <reference lib="webworker" />
// Service worker unique : installabilité PWA (précache Workbox) + notifications
// push (rappel médicament, section 8 du plan). Exclu du typecheck du projet
// principal (tsconfig.app.json) — DOM et WebWorker ont des types incompatibles ;
// esbuild (vite-plugin-pwa) le bundle sans vérification de types, comme les
// autres service workers Vite/Workbox.
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
