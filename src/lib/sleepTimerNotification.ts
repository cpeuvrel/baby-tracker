import { formatDuration, secondsBetween } from './duration'

/** Prefix of the timer notifications' tags: one per baby, replaced in place while its timer runs. */
export const SLEEP_TIMER_NOTIFICATION_TAG = 'sleep-timer'

export function sleepTimerTag(babyId: string): string {
  return `${SLEEP_TIMER_NOTIFICATION_TAG}-${babyId}`
}

/** Whether a notification is a sleep timer one (any baby, or the single tag of older versions). */
export function isSleepTimerTag(tag: string): boolean {
  return tag === SLEEP_TIMER_NOTIFICATION_TAG || tag.startsWith(`${SLEEP_TIMER_NOTIFICATION_TAG}-`)
}

/** Chrome's own "This site has been updated in the background" notification. */
export const CHROME_AUTO_NOTIFICATION_TAG = 'user_visible_auto_notification'

/** Opens the Activity screen with the running sleep timer on top. */
export const SLEEP_TIMER_URL = '/?timer=sleep'

/** Query param naming the timer's child, selected on arrival. */
export const SLEEP_TIMER_BABY_PARAM = 'baby'

/** The timer of a given child (the notification's tap): selects that child first. */
export function sleepTimerUrl(babyId: string): string {
  return `${SLEEP_TIMER_URL}&${SLEEP_TIMER_BABY_PARAM}=${encodeURIComponent(babyId)}`
}

export function sleepTimerNotificationBody(babyName: string, startedAt: Date, now: Date): string {
  return `${babyName} — ${formatDuration(secondsBetween(startedAt, now))}`
}

export const SLEEP_TIMER_TITLE = 'Sleep Timer'

/** `data.type` of the server's pushes (functions/src/sleepTimer.ts). */
export const SLEEP_TIMER_PUSH = 'sleep-timer'
export const SLEEP_TIMER_STOP_PUSH = 'sleep-timer-stop'

/** Shared by the app and the service worker (server pushes while the app is in the background). */
export function sleepTimerNotificationOptions(
  babyId: string,
  babyName: string,
  startedAt: Date,
  now: Date,
): NotificationOptions {
  return {
    body: sleepTimerNotificationBody(babyName, startedAt, now),
    icon: '/icon-192.png',
    // Status bar glyph on Android: white on transparent, else it shows Chrome's.
    badge: '/badge-96.png',
    tag: sleepTimerTag(babyId),
    silent: true,
    requireInteraction: true,
    timestamp: startedAt.getTime(),
    data: { url: sleepTimerUrl(babyId) },
  } as NotificationOptions
}

/** Closes the timer notification of a baby, or every timer notification without `babyId`. */
export async function closeSleepTimerNotifications(
  registration: ServiceWorkerRegistration,
  babyId?: string,
): Promise<void> {
  const notifications = await registration.getNotifications(babyId ? { tag: sleepTimerTag(babyId) } : undefined)
  notifications
    .filter((notification) => (babyId ? true : isSleepTimerTag(notification.tag)))
    .forEach((notification) => notification.close())
}

function notificationsAllowed(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator
}

/** Shows or silently refreshes the "Sleep Timer" notification of a baby. */
export async function showSleepTimerNotification(
  babyId: string,
  babyName: string,
  startedAt: Date,
  now: Date,
): Promise<void> {
  if (!notificationsAllowed()) return
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(
    SLEEP_TIMER_TITLE,
    sleepTimerNotificationOptions(babyId, babyName, startedAt, now),
  )
}

export async function closeSleepTimerNotification(babyId: string): Promise<void> {
  if (!notificationsAllowed()) return
  await closeSleepTimerNotifications(await navigator.serviceWorker.ready, babyId)
}
