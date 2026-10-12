import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { forEachBaby } from './households'
import { parisDateValue, startOfParisDay, zonedParts } from './parisTime'
import type { HouseholdSender } from './push'

// `data.type` the service worker reads (src/lib/backgroundPush.ts).
export const MEDICATION_REMINDER_PUSH = 'medication-reminder'

// Still worth showing a few hours late, not on a later day.
const REMINDER_TTL_SECONDS = 6 * 60 * 60

export interface MedicationReminder {
  medicationName: string
  /** Paris wall-clock "HH:MM". */
  timeOfDay: string
  active?: boolean
  /** Paris day ("YYYY-MM-DD") the reminder was dealt with: sent, or not needed since the dose was logged. */
  lastSentOn?: string
}

function minutesSinceMidnight(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Due once the reminder time has passed today (Paris) and not dealt with yet
 * today: a missed or late run catches up at the next one, a retried run or the
 * hour repeated when clocks go back does not send it twice, and an hour skipped
 * when clocks go forward still gets it (at 03:00).
 */
export function shouldSendReminder(
  reminder: Pick<MedicationReminder, 'timeOfDay' | 'lastSentOn'>,
  now: Date,
  today: string,
): boolean {
  if (reminder.lastSentOn === today) return false
  const { hour, minute } = zonedParts(now)
  return hour * 60 + minute >= minutesSinceMidnight(reminder.timeOfDay)
}

/**
 * Same rule as the app (src/pages/ActivityPage.tsx `isVitamin`): any name
 * starting like the reminder's first word counts, e.g. "Vitamin D",
 * "vitamin d" or "Vitamin/Probiotic" for the "Vitamin D" reminder.
 */
export function medicationMatches(entryName: string, medicationName: string): boolean {
  const prefix = medicationName.trim().toLowerCase().split(/\s+/)[0]
  return prefix !== '' && entryName.trim().toLowerCase().startsWith(prefix)
}

async function hasMedicationToday(babyRef: DocumentReference, medicationName: string, now: Date): Promise<boolean> {
  // A single range on `givenAt` (a handful of doses a day) needs no composite
  // index; the name is matched here, with the app's rule.
  const snapshot = await babyRef
    .collection('medicationEntries')
    .where('givenAt', '>=', Timestamp.fromDate(startOfParisDay(now)))
    .get()
  return snapshot.docs.some((entry) => {
    const name = entry.data().name
    return typeof name === 'string' && medicationMatches(name, medicationName)
  })
}

/** One run of the medication reminders: "Vitamin D hasn't been given yet today". */
export async function runMedicationCheck(db: Firestore, now: Date, send: HouseholdSender): Promise<void> {
  const today = parisDateValue(now)
  await forEachBaby(db, 'Medication reminder', async (household, baby) => {
    const reminders = await baby.ref.collection('reminders').where('active', '==', true).get()
    for (const reminderDoc of reminders.docs) {
      const reminder = reminderDoc.data() as MedicationReminder
      if (!shouldSendReminder(reminder, now, today)) continue

      if (!(await hasMedicationToday(baby.ref, reminder.medicationName, now))) {
        logger.info('Sending medication reminder', {
          householdId: household.id,
          babyId: baby.id,
          medicationName: reminder.medicationName,
        })
        await send(
          household.ref,
          { type: MEDICATION_REMINDER_PUSH, medicationName: reminder.medicationName },
          REMINDER_TTL_SECONDS,
        )
      }
      await reminderDoc.ref.update({ lastSentOn: today })
    }
  })
}
