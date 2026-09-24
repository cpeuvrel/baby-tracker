import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { startOfParisDay, zonedParts } from './parisTime'

initializeApp()

const CHECK_INTERVAL_MINUTES = 15

function minutesSinceMidnight(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

/** Whether `now` (read in Paris time) falls in [timeOfDay, timeOfDay + interval). */
export function isWithinCheckWindow(timeOfDay: string, now: Date, intervalMinutes: number): boolean {
  const target = minutesSinceMidnight(timeOfDay)
  const { hour, minute } = zonedParts(now)
  const current = hour * 60 + minute
  return current >= target && current < target + intervalMinutes
}

async function hasMedicationToday(
  babyRef: DocumentReference,
  medicationName: string,
  now: Date,
): Promise<boolean> {
  const startOfDay = startOfParisDay(now)

  const snapshot = await babyRef
    .collection('medicationEntries')
    .where('name', '==', medicationName)
    .where('givenAt', '>=', Timestamp.fromDate(startOfDay))
    .limit(1)
    .get()

  return !snapshot.empty
}

async function collectHouseholdTokens(
  householdRef: DocumentReference,
): Promise<string[]> {
  const householdSnap = await householdRef.get()
  const memberUids = (householdSnap.data()?.memberUids as string[] | undefined) ?? []

  const tokens: string[] = []
  for (const uid of memberUids) {
    const tokensSnap = await householdRef.firestore
      .collection('users')
      .doc(uid)
      .collection('fcmTokens')
      .get()
    tokens.push(...tokensSnap.docs.map((doc) => doc.id))
  }
  return tokens
}

async function sendMedicationReminder(
  householdRef: DocumentReference,
  medicationName: string,
): Promise<void> {
  const tokens = await collectHouseholdTokens(householdRef)
  if (tokens.length === 0) return

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: `Reminder: ${medicationName}`,
      body: `${medicationName} hasn't been given yet today.`,
    },
  })
}

export const checkMedicationReminders = onSchedule(
  { schedule: `every ${CHECK_INTERVAL_MINUTES} minutes`, timeZone: 'Europe/Paris' },
  async () => {
    const db = getFirestore()
    const now = new Date()

    const householdsSnap = await db.collection('households').get()

    for (const householdDoc of householdsSnap.docs) {
      const babiesSnap = await householdDoc.ref.collection('babies').get()

      for (const babyDoc of babiesSnap.docs) {
        const remindersSnap = await babyDoc.ref
          .collection('reminders')
          .where('active', '==', true)
          .get()

        for (const reminderDoc of remindersSnap.docs) {
          const reminder = reminderDoc.data() as { medicationName: string; timeOfDay: string }

          if (!isWithinCheckWindow(reminder.timeOfDay, now, CHECK_INTERVAL_MINUTES)) continue
          if (await hasMedicationToday(babyDoc.ref, reminder.medicationName, now)) continue

          logger.info('Sending medication reminder', {
            householdId: householdDoc.id,
            babyId: babyDoc.id,
            medicationName: reminder.medicationName,
          })
          await sendMedicationReminder(householdDoc.ref, reminder.medicationName)
        }
      }
    }
  },
)
