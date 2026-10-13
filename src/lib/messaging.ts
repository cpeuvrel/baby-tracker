import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app } from './firebase'

function notificationsGranted(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/** This device's FCM token, permission granted; `null` when it can't be had. */
async function messagingToken(): Promise<string | null> {
  const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY
  if (!vapidKey) return null

  try {
    const registration = await navigator.serviceWorker.ready
    return await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration })
  } catch {
    return null
  }
}

/**
 * This device's FCM token, asking for the notification permission if it
 * hasn't been answered yet (call it from a user gesture). `null` when refused
 * or unavailable (no push support, private browsing, older Safari).
 */
export async function requestNotificationToken(): Promise<string | null> {
  try {
    if (!(await isSupported())) return null
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') return null
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return null
    }
  } catch {
    // Older Safari only has the callback form of requestPermission.
    return null
  }
  return messagingToken()
}

/** This device's FCM token if notifications are already allowed: never asks. */
export async function currentNotificationToken(): Promise<string | null> {
  if (!notificationsGranted()) return null
  try {
    if (!(await isSupported())) return null
  } catch {
    return null
  }
  return messagingToken()
}

/**
 * Invalidates this device's FCM token: the server's pushes stop reaching it.
 * Call after `currentNotificationToken` (which binds the app's service worker).
 */
export async function deleteNotificationToken(): Promise<void> {
  try {
    await deleteToken(getMessaging(app))
  } catch {
    // Best effort: the server drops the token once it is reported unregistered.
  }
}
