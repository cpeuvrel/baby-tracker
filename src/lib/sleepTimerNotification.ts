import { formatDuration, secondsBetween } from './duration'

/** One notification per device, replaced in place while the timer runs. */
export const SLEEP_TIMER_NOTIFICATION_TAG = 'sleep-timer'

/** Opens the Activity screen with the running sleep timer on top. */
export const SLEEP_TIMER_URL = '/?timer=sleep'

export function sleepTimerNotificationBody(babyName: string, startedAt: Date, now: Date): string {
  return `${babyName} — ${formatDuration(secondsBetween(startedAt, now))}`
}

export const SLEEP_TIMER_TITLE = 'Sleep Timer'

/** `data.type` of the server's pushes (functions/src/sleepTimer.ts). */
export const SLEEP_TIMER_PUSH = 'sleep-timer'
export const SLEEP_TIMER_STOP_PUSH = 'sleep-timer-stop'

/** Shared by the app and the service worker (server pushes while the app is in the background). */
export function sleepTimerNotificationOptions(babyName: string, startedAt: Date, now: Date): NotificationOptions {
  return {
    body: sleepTimerNotificationBody(babyName, startedAt, now),
    icon: '/icon-192.png',
    // Status bar glyph on Android: white on transparent, else it shows Chrome's.
    badge: '/badge-96.png',
    tag: SLEEP_TIMER_NOTIFICATION_TAG,
    silent: true,
    requireInteraction: true,
    timestamp: startedAt.getTime(),
    data: { url: SLEEP_TIMER_URL },
  } as NotificationOptions
}

function notificationsAllowed(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator
}

/** Asks once, from the tap that starts the timer (browsers require a user gesture). */
export async function requestSleepTimerNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    // Older Safari only has the callback form; the notification is a nicety.
  }
}

/** Shows or silently refreshes the "Sleep Timer" notification. */
export async function showSleepTimerNotification(babyName: string, startedAt: Date, now: Date): Promise<void> {
  if (!notificationsAllowed()) return
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(SLEEP_TIMER_TITLE, sleepTimerNotificationOptions(babyName, startedAt, now))
}

export async function closeSleepTimerNotification(): Promise<void> {
  if (!notificationsAllowed()) return
  const registration = await navigator.serviceWorker.ready
  const notifications = await registration.getNotifications({ tag: SLEEP_TIMER_NOTIFICATION_TAG })
  notifications.forEach((notification) => notification.close())
}
