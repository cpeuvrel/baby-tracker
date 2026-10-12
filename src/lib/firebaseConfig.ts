/**
 * The web app's Firebase project, from the `VITE_FIREBASE_*` env vars. Shared
 * by the page (firebase.ts) and the service worker (sw.ts, also built by
 * Vite), so both always talk to the same project and FCM sender.
 * No DOM dependency: the service worker imports it.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
