import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

/** True when the app talks to the local emulators rather than the real Firebase project. */
export const usingEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/**
 * After sign-out: drops the Firestore data cached on this device (a shared
 * phone keeps nothing readable), then reloads the app, as the terminated
 * Firestore instance can't be used again.
 */
export async function clearLocalDataAndReload(): Promise<void> {
  try {
    // The SDK only clears the cache of a terminated instance.
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch (cause) {
    console.error('[auth] could not clear the local Firestore cache', cause)
  }
  window.location.reload()
}
