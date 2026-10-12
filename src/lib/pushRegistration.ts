import { clearSleepTimerMute, saveFcmToken } from '../repositories/fcmTokens'
import { requestNotificationToken } from './messaging'
import { savePushIdentity } from './pushIdentity'

let registeredUid: string | null = null
let registeredToken: string | null = null

/**
 * Registers this device for the server's pushes: the sleep timer ones, which
 * keep the notification's elapsed time current while the app is in the
 * background, and the vaccine reminders before a pediatrician visit.
 * Once per session; only asks for permission if it hasn't been answered yet.
 */
export async function registerPush(uid: string): Promise<void> {
  if (registeredUid === uid) return
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return
  const token = await requestNotificationToken()
  if (!token) return
  await saveFcmToken(uid, token)
  registeredUid = uid
  registeredToken = token
  await savePushIdentity({ uid, token }).catch(() => {})
}

/** Opening the app brings back a sleep timer notification swiped away on this device. */
export async function unmuteSleepTimer(uid: string): Promise<void> {
  await registerPush(uid)
  if (registeredUid !== uid || registeredToken == null) return
  await clearSleepTimerMute(uid, registeredToken)
}
