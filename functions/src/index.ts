import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { runMedicationCheck } from './medicationReminders'
import { APP_TIME_ZONE } from './parisTime'
import { senderForRun } from './push'

initializeApp()

const CHECK_INTERVAL_MINUTES = 15

/** Every 15 minutes: the medication reminders whose time has come today (see shouldSendReminder). */
export const checkMedicationReminders = onSchedule(
  { schedule: `every ${CHECK_INTERVAL_MINUTES} minutes`, timeZone: APP_TIME_ZONE },
  async () => {
    await runMedicationCheck(getFirestore(), new Date(), senderForRun())
  },
)

export { onSleepEntryWritten, tickSleepTimerNotifications } from './sleepTimer'
export { askVaccinePurchase, onPediatricianVisitWritten, remindVaccineDay } from './vaccineReminders'
