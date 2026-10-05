import { getFirestore, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { collectHouseholdTokens } from './tokens'

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

const UNREGISTERED_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

async function sendToHousehold(householdRef: DocumentReference, data: Record<string, string>): Promise<void> {
  const tokens = await collectHouseholdTokens(householdRef)
  if (tokens.length === 0) return

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(({ token }) => token),
    // Data only: the service worker builds the notification itself.
    data,
    webpush: { headers: { Urgency: 'high', TTL: String(TICK_TTL_SECONDS) } },
  })

  // Uninstalled apps and cleared browsers: stop pushing to them every minute.
  await Promise.all(
    response.responses.map((result, index) =>
      result.error && UNREGISTERED_TOKEN_CODES.has(result.error.code) ? tokens[index].ref.delete() : null,
    ),
  )
}

async function sendRunningTimer(entry: DocumentSnapshot): Promise<void> {
  const babyRef = entry.ref.parent.parent
  const householdRef = babyRef?.parent.parent
  const startedAt = (entry.data() as SleepFields | undefined)?.startedAt?.toDate()
  if (!babyRef || !householdRef || !startedAt) return

  const babyName = ((await babyRef.get()).data()?.name as string | undefined) ?? 'Baby'
  await sendToHousehold(householdRef, {
    type: SLEEP_TIMER_PUSH,
    babyName,
    startedAt: startedAt.toISOString(),
  })
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
      await sendToHousehold(event.data.before.ref.parent.parent!.parent.parent!, { type: SLEEP_TIMER_STOP_PUSH })
    } else {
      await sendRunningTimer(event.data.after)
    }
  },
)
