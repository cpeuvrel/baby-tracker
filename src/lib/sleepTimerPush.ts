import { saveFcmToken } from '../repositories/fcmTokens'
import { requestNotificationToken } from './messaging'

let registeredUid: string | null = null

/**
 * Registers this device for the server's sleep timer pushes, which keep the
 * notification's elapsed time current while the app is in the background.
 * Once per session; only asks for permission if it hasn't been answered yet.
 */
export async function registerSleepTimerPush(uid: string): Promise<void> {
  if (registeredUid === uid) return
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return
  const token = await requestNotificationToken()
  if (!token) return
  await saveFcmToken(uid, token)
  registeredUid = uid
}
