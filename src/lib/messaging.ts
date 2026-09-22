import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app } from './firebase'

export async function requestNotificationToken(): Promise<string | null> {
  if (!(await isSupported())) return null
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
  }

  const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY
  if (!vapidKey) return null

  const registration = await navigator.serviceWorker.ready
  const messaging = getMessaging(app)

  try {
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  } catch {
    return null
  }
}
