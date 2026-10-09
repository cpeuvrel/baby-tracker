import { getFirestore, type DocumentReference } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { APP_TIME_ZONE, zonedParts } from './parisTime'
import { sendToHousehold } from './push'

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

/** Today's Paris calendar day as "YYYY-MM-DD", like the visits' `date`. */
export function parisDateValue(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const p = zonedParts(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
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

/** Every vaccine visit of the household's babies passing `select`, from today to the purchase horizon. */
async function forEachVaccineVisit(
  today: string,
  select: (visit: VaccineVisit) => boolean,
  send: (householdRef: DocumentReference, data: Record<string, string>) => Promise<void>,
): Promise<void> {
  const households = await getFirestore().collection('households').get()
  for (const household of households.docs) {
    const babies = await household.ref.collection('babies').get()
    for (const baby of babies.docs) {
      // Range on the date only: filtering on `vaccinated` too would need a composite index.
      const visits = await baby.ref
        .collection('pediatricianVisits')
        .where('date', '>=', today)
        .where('date', '<=', addDays(today, VACCINE_PURCHASE_LEAD_DAYS))
        .get()
      for (const visit of visits.docs) {
        const data = visit.data() as VaccineVisit
        if (!select(data)) continue
        logger.info('Sending vaccine reminder', { householdId: household.id, babyId: baby.id, visitId: visit.id })
        await send(household.ref, {
          babyId: baby.id,
          babyName: (baby.data().name as string | undefined) ?? 'Baby',
          visitId: visit.id,
          visitDate: data.date,
        })
      }
    }
  }
}

/** 12:00 (Paris), 4 days to 1 day before a vaccine visit: "have you bought the vaccine?" until yes. */
export const askVaccinePurchase = onSchedule({ schedule: '0 12 * * *', timeZone: APP_TIME_ZONE }, async () => {
  const today = parisDateValue(new Date())
  await forEachVaccineVisit(
    today,
    (visit) => needsPurchaseQuestion(visit, today),
    (householdRef, data) =>
      sendToHousehold(householdRef, { type: VACCINE_PURCHASE_PUSH, ...data }, REMINDER_TTL_SECONDS),
  )
})

/** 8:30 (Paris) on the day of a vaccine visit: don't forget to take the vaccine. */
export const remindVaccineDay = onSchedule({ schedule: '30 8 * * *', timeZone: APP_TIME_ZONE }, async () => {
  const today = parisDateValue(new Date())
  await forEachVaccineVisit(
    today,
    (visit) => needsDayReminder(visit, today),
    (householdRef, data) => sendToHousehold(householdRef, { type: VACCINE_DAY_PUSH, ...data }, REMINDER_TTL_SECONDS),
  )
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
