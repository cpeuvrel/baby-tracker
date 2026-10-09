import { getMessaging, isSupported, onMessage } from 'firebase/messaging'
import { app } from './firebase'
import { readVaccinePush, vaccineNotification } from './vaccineNotification'

/**
 * While the app is in the foreground, pushes reach the page instead of the
 * service worker: show the vaccine reminders anyway (the sleep timer one is
 * already drawn by the app itself). Returns an unsubscribe function.
 */
export async function showVaccinePushesInForeground(): Promise<() => void> {
  if (!('serviceWorker' in navigator) || !(await isSupported())) return () => {}
  return onMessage(getMessaging(app), (payload) => {
    const push = readVaccinePush(payload.data)
    if (!push || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const { title, options } = vaccineNotification(push)
    void navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, options))
  })
}
