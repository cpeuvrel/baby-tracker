import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { babyNameOf, forEachBaby } from './households'
import { APP_TIME_ZONE, parisDateValue } from './parisTime'
import { sendToHousehold, senderForRun, type HouseholdSender } from './push'

// `data.type` the service worker reads (src/lib/vaccineNotification.ts).
const VACCINE_PURCHASE_PUSH = 'vaccine-purchase'
const VACCINE_DAY_PUSH = 'vaccine-day'
const VACCINE_PURCHASE_CLOSE_PUSH = 'vaccine-purchase-close'

/** The purchase question starts this many days before the visit, then comes back daily. */
export const VACCINE_PURCHASE_LEAD_DAYS = 4

// Still worth showing a few hours late, not once the next reminder is due.
const REMINDER_TTL_SECONDS = 6 * 60 * 60

export interface VaccineVisit {
  date: string
  vaccinated?: boolean
  vaccineBought?: boolean
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Noon question "bought the vaccine?": from 4 days before a vaccine visit up to
 * the day before, until someone answers yes.
 */
export function needsPurchaseQuestion(visit: VaccineVisit, today: string): boolean {
  return (
    visit.vaccinated === true &&
    visit.vaccineBought !== true &&
    visit.date > today &&
    visit.date <= addDays(today, VACCINE_PURCHASE_LEAD_DAYS)
  )
}

/** Morning reminder on the day of a vaccine visit, whatever the purchase answer. */
export function needsDayReminder(visit: VaccineVisit, today: string): boolean {
  return visit.vaccinated === true && visit.date === today
}

/**
 * Whether a write settles the purchase question of a visit (vaccine bought,
 * vaccine dropped, visit deleted): the question showing on the other phones goes.
 */
export function purchaseQuestionSettled(before: VaccineVisit | undefined, after: VaccineVisit | undefined): boolean {
  const asked = (visit: VaccineVisit | undefined) => visit?.vaccinated === true && visit.vaccineBought !== true
  return asked(before) && !asked(after)
}

/** Sends `type` for every vaccine visit passing `select`, from today to the purchase horizon. */
async function remindVaccineVisits(
  db: Firestore,
  today: string,
  type: string,
  select: (visit: VaccineVisit) => boolean,
  send: HouseholdSender,
): Promise<void> {
  await forEachBaby(db, 'Vaccine reminder', async (household, baby) => {
    // Range on the date only: filtering on `vaccinated` too would need a composite index.
    const visits = await baby.ref
      .collection('pediatricianVisits')
      .where('date', '>=', today)
      .where('date', '<=', addDays(today, VACCINE_PURCHASE_LEAD_DAYS))
      .get()
    for (const visit of visits.docs) {
      const data = visit.data() as VaccineVisit
      if (!select(data)) continue
      logger.info('Sending vaccine reminder', { householdId: household.id, babyId: baby.id, visitId: visit.id, type })
      await send(
        household.ref,
        { type, babyId: baby.id, babyName: babyNameOf(baby), visitId: visit.id, visitDate: data.date },
        REMINDER_TTL_SECONDS,
      )
    }
  })
}

/** "Have you bought the vaccine?" for the visits 4 days to 1 day ahead, until someone says yes. */
export function runVaccinePurchaseQuestions(db: Firestore, today: string, send: HouseholdSender): Promise<void> {
  return remindVaccineVisits(db, today, VACCINE_PURCHASE_PUSH, (visit) => needsPurchaseQuestion(visit, today), send)
}

/** "Don't forget the vaccine" on the day of the visit. */
export function runVaccineDayReminders(db: Firestore, today: string, send: HouseholdSender): Promise<void> {
  return remindVaccineVisits(db, today, VACCINE_DAY_PUSH, (visit) => needsDayReminder(visit, today), send)
}

/** 12:00 (Paris), 4 days to 1 day before a vaccine visit: "have you bought the vaccine?" until yes. */
export const askVaccinePurchase = onSchedule({ schedule: '0 12 * * *', timeZone: APP_TIME_ZONE }, async () => {
  await runVaccinePurchaseQuestions(getFirestore(), parisDateValue(new Date()), senderForRun())
})

/** 8:30 (Paris) on the day of a vaccine visit: don't forget to take the vaccine. */
export const remindVaccineDay = onSchedule({ schedule: '30 8 * * *', timeZone: APP_TIME_ZONE }, async () => {
  await runVaccineDayReminders(getFirestore(), parisDateValue(new Date()), senderForRun())
})

/** Someone answered "yes" (or the vaccine is no longer planned): clears the question on every phone. */
export const onPediatricianVisitWritten = onDocumentWritten(
  'households/{householdId}/babies/{babyId}/pediatricianVisits/{visitId}',
  async (event) => {
    if (!event.data) return
    const settled = purchaseQuestionSettled(
      event.data.before.data() as VaccineVisit | undefined,
      event.data.after.data() as VaccineVisit | undefined,
    )
    if (!settled) return

    logger.info('Closing vaccine purchase question', event.params)
    const householdRef = event.data.before.ref.parent.parent!.parent.parent!
    await sendToHousehold(
      householdRef,
      { type: VACCINE_PURCHASE_CLOSE_PUSH, visitId: event.params.visitId },
      REMINDER_TTL_SECONDS,
    )
  },
)
