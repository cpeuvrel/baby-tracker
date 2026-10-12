import { getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { sendToHousehold } from './push'

// `data.type` the service worker reads (src/lib/sleepTimerNotification.ts).
const SLEEP_TIMER_PUSH = 'sleep-timer'
const SLEEP_TIMER_STOP_PUSH = 'sleep-timer-stop'

// A tick is worthless once the next one is due.
const TICK_TTL_SECONDS = 60

interface SleepFields {
  startedAt?: { toDate(): Date } | null
  endedAt?: unknown
}

export type SleepChange = 'started' | 'moved' | 'stopped' | null

/** What a write to a sleep entry means for the running-timer notification. */
export function sleepChange(before: SleepFields | undefined, after: SleepFields | undefined): SleepChange {
  const wasRunning = before != null && before.endedAt == null
  const isRunning = after != null && after.endedAt == null
  if (!wasRunning && isRunning) return 'started'
  if (wasRunning && !isRunning) return 'stopped'
  if (
    wasRunning &&
    isRunning &&
    before.startedAt?.toDate().getTime() !== after.startedAt?.toDate().getTime()
  ) {
    return 'moved'
  }
  return null
}

async function sendRunningTimer(entry: DocumentSnapshot): Promise<void> {
  const babyRef = entry.ref.parent.parent
  const householdRef = babyRef?.parent.parent
  const startedAt = (entry.data() as SleepFields | undefined)?.startedAt?.toDate()
  if (!babyRef || !householdRef || !startedAt) return

  const babyName = ((await babyRef.get()).data()?.name as string | undefined) ?? 'Baby'
  await sendToHousehold(
    householdRef,
    { type: SLEEP_TIMER_PUSH, babyName, startedAt: startedAt.toISOString(), entryId: entry.id },
    TICK_TTL_SECONDS,
    // Swiped away on that device: it stays away until the app is opened there again.
    (token) => token.mutedSleepEntryId === entry.id,
  )
}

/** Every minute while a sleep runs: refreshes the elapsed time on the household's devices. */
export const tickSleepTimerNotifications = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Europe/Paris' },
  async () => {
    // Household by household, like the medication reminders: a collection
    // group query would need an extra index deployed by hand.
    const households = await getFirestore().collection('households').get()
    for (const household of households.docs) {
      const babies = await household.ref.collection('babies').get()
      for (const baby of babies.docs) {
        const running = await baby.ref.collection('sleepEntries').where('endedAt', '==', null).get()
        await Promise.all(running.docs.map((entry) => sendRunningTimer(entry)))
      }
    }
  },
)

/** Shows the notification as soon as a sleep starts or moves, and clears it everywhere when it stops. */
export const onSleepEntryWritten = onDocumentWritten(
  'households/{householdId}/babies/{babyId}/sleepEntries/{entryId}',
  async (event) => {
    const change = sleepChange(
      event.data?.before.data() as SleepFields | undefined,
      event.data?.after.data() as SleepFields | undefined,
    )
    if (change == null || !event.data) return

    logger.info('Sleep timer notification', { change, ...event.params })
    if (change === 'stopped') {
      const householdRef = event.data.before.ref.parent.parent!.parent.parent!
      await sendToHousehold(householdRef, { type: SLEEP_TIMER_STOP_PUSH }, TICK_TTL_SECONDS)
    } else {
      await sendRunningTimer(event.data.after)
    }
  },
)

function isDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !value.includes('/')
}

/**
 * Called by the service worker when the running sleep's notification is swiped
 * away: stops refreshing it on that device, for that sleep. The app clears the
 * mute when it is opened again (src/repositories/fcmTokens.ts). The device's
 * own FCM token, unguessable, stands for its signed-in user.
 */
export const muteSleepTimer = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).end()
    return
  }
  const { uid, token, entryId } = (request.body ?? {}) as Record<string, unknown>
  if (!isDocumentId(uid) || !isDocumentId(token) || !isDocumentId(entryId)) {
    response.status(400).end()
    return
  }

  const tokenRef = getFirestore().collection('users').doc(uid).collection('fcmTokens').doc(token)
  if (!(await tokenRef.get()).exists) {
    response.status(404).end()
    return
  }
  await tokenRef.update({ mutedSleepEntryId: entryId })
  response.status(204).end()
})
