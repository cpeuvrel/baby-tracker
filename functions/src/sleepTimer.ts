import { getFirestore, type DocumentReference, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { babyNameOf, forEachBaby } from './households'
import { sendToHousehold, senderForRun, type HouseholdSender } from './push'

// `data.type` the service worker reads (src/lib/sleepTimerNotification.ts).
const SLEEP_TIMER_PUSH = 'sleep-timer'
const SLEEP_TIMER_STOP_PUSH = 'sleep-timer-stop'

// A tick is worthless once the next one is due.
export const TICK_TTL_SECONDS = 60
// The stop is not: without it the notification stays on a phone that was
// offline at that moment. Closing it late is harmless (a sleep started since
// shows again at the next tick).
export const STOP_TTL_SECONDS = 24 * 60 * 60

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

interface RunningSleep {
  /** Start of the sleep the baby's notification shows, `null` when none runs. */
  startedAt: Date | null
  /**
   * Server time of the read that found it, sent with every push (`asOf`): a
   * phone ignores a timer push read before the last stop it got, so a tick
   * delivered after the stop cannot bring the notification back.
   */
  asOf: string
}

/**
 * The earliest running sleep, like the app (two devices may have started the
 * same sleep).
 */
async function runningSleep(babyRef: DocumentReference): Promise<RunningSleep> {
  const running = await babyRef.collection('sleepEntries').where('endedAt', '==', null).get()
  let earliest: Date | null = null
  for (const entry of running.docs) {
    const startedAt = (entry.data() as SleepFields).startedAt?.toDate()
    if (startedAt && (earliest == null || startedAt < earliest)) earliest = startedAt
  }
  return { startedAt: earliest, asOf: running.readTime.toDate().toISOString() }
}

function runningTimerPush(babyId: string, babyName: string, startedAt: Date, asOf: string): Record<string, string> {
  return { type: SLEEP_TIMER_PUSH, babyId, babyName, startedAt: startedAt.toISOString(), asOf }
}

/** One tick: one push per baby whose sleep runs, refreshing its notification's elapsed time. */
export async function runSleepTick(db: Firestore, send: HouseholdSender): Promise<void> {
  await forEachBaby(db, 'Sleep timer tick', async (household, baby) => {
    const { startedAt, asOf } = await runningSleep(baby.ref)
    if (startedAt == null) return
    await send(household.ref, runningTimerPush(baby.id, babyNameOf(baby), startedAt, asOf), TICK_TTL_SECONDS)
  })
}

/**
 * A sleep entry was written: shows the baby's notification as soon as a sleep
 * starts or moves, and clears it everywhere once none of the baby's sleeps runs.
 */
export async function handleSleepEntryWrite(
  before: DocumentSnapshot,
  after: DocumentSnapshot,
  send: HouseholdSender,
): Promise<void> {
  const change = sleepChange(before.data() as SleepFields | undefined, after.data() as SleepFields | undefined)
  if (change == null) return

  const babyRef = after.ref.parent.parent!
  const householdRef = babyRef.parent.parent!
  const { startedAt, asOf } = await runningSleep(babyRef)
  logger.info('Sleep timer notification', { change, babyId: babyRef.id, running: startedAt != null })
  if (startedAt != null) {
    // Started, moved, or stopped while another sleep of the baby still runs: show that one.
    const babyName = babyNameOf(await babyRef.get())
    await send(householdRef, runningTimerPush(babyRef.id, babyName, startedAt, asOf), TICK_TTL_SECONDS)
  } else if (change === 'stopped') {
    await send(householdRef, { type: SLEEP_TIMER_STOP_PUSH, babyId: babyRef.id, asOf }, STOP_TTL_SECONDS)
  }
}

/** Every minute while a sleep runs: refreshes the elapsed time on the household's devices. */
export const tickSleepTimerNotifications = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Europe/Paris' },
  async () => {
    // Household by household, like the medication reminders: a collection
    // group query would need an extra index deployed by hand.
    await runSleepTick(getFirestore(), senderForRun())
  },
)

export const onSleepEntryWritten = onDocumentWritten(
  'households/{householdId}/babies/{babyId}/sleepEntries/{entryId}',
  async (event) => {
    if (!event.data) return
    await handleSleepEntryWrite(event.data.before, event.data.after, sendToHousehold)
  },
)
