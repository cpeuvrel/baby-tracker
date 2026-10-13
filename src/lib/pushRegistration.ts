import { deleteFcmToken, saveFcmToken } from '../repositories/fcmTokens'
import { currentNotificationToken, deleteNotificationToken, requestNotificationToken } from './messaging'

let registered: { uid: string; token: string } | null = null

// A Firestore write only settles once the server has it: offline, signing out
// must not wait for it forever.
const UNREGISTER_TIMEOUT_MS = 5000

/**
 * Registers this device for the server's pushes: the sleep timer ones, which
 * keep the notification's elapsed time current while the app is in the
 * background, and the medication and vaccine reminders.
 * Once per session; only asks for permission if it hasn't been answered yet.
 * Resolves to whether this device is registered.
 */
export async function registerPush(uid: string): Promise<boolean> {
  if (registered?.uid === uid) return true
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return false
  const token = await requestNotificationToken()
  if (!token) return false
  await saveFcmToken(uid, token)
  registered = { uid, token }
  return true
}

/**
 * Sign-out: this device stops getting the household's pushes. Forgets its
 * token for `uid` (before signing out: only the owner may delete it) and
 * invalidates it at FCM. Best effort, never throws.
 */
export async function unregisterPush(uid: string): Promise<void> {
  const known = registered?.uid === uid ? registered.token : null
  registered = null
  // Also binds the app's service worker to messaging, which deleteNotificationToken needs.
  const current = await currentNotificationToken().catch(() => null)
  const token = known ?? current
  if (!token) return

  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    deleteFcmToken(uid, token).catch(() => {}),
    new Promise<void>((resolve) => (timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS))),
  ])
  clearTimeout(timer)
  if (current) await deleteNotificationToken()
}
