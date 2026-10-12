import { getMessaging, isSupported, onMessage } from 'firebase/messaging'
import { handleBackgroundPush } from './backgroundPush'
import { app } from './firebase'

/**
 * While the app is in the foreground, pushes reach the page instead of the
 * service worker: show (or clear) their notifications anyway, as the service
 * worker would (sleep timers of every baby, medication and vaccine reminders).
 * Returns an unsubscribe function.
 */
export async function showVaccinePushesInForeground(): Promise<() => void> {
  if (!('serviceWorker' in navigator) || !(await isSupported())) return () => {}
  return onMessage(getMessaging(app), (payload) => {
    if (!payload.data || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const data = payload.data
    void navigator.serviceWorker.ready
      .then((registration) => handleBackgroundPush(registration, data, new Date()))
      .catch(() => {})
  })
}
