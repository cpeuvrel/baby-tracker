import { formatVisitDate } from './visitDate'

/** `data.type` of the server's pushes (functions/src/vaccineReminders.ts). */
export const VACCINE_PURCHASE_PUSH = 'vaccine-purchase'
export const VACCINE_DAY_PUSH = 'vaccine-day'

/** Notification actions of the purchase question. */
export const VACCINE_BOUGHT_ACTION = 'vaccine-bought'
export const VACCINE_NOT_BOUGHT_ACTION = 'vaccine-not-bought'

/** Query param that makes the visit screen record the purchase (the "Yes" action). */
export const VACCINE_BOUGHT_PARAM = 'vaccineBought'

/** Query param naming the visit's child, selected on arrival. */
export const VISIT_BABY_PARAM = 'baby'

export interface VaccinePush {
  type: string
  babyId: string
  babyName: string
  visitId: string
  visitDate: string
}

export interface VaccineNotificationData {
  url: string
  boughtUrl: string
}

export function readVaccinePush(data: Record<string, string> | undefined): VaccinePush | null {
  if (!data) return null
  const { type, babyId, babyName, visitId, visitDate } = data
  if (type !== VACCINE_PURCHASE_PUSH && type !== VACCINE_DAY_PUSH) return null
  if (!babyId || !visitId || !visitDate) return null
  return { type, babyId, babyName: babyName || 'Baby', visitId, visitDate }
}

export function vaccineVisitUrl(babyId: string, visitId: string): string {
  return `/account/pediatrician/visits/${visitId}?${VISIT_BABY_PARAM}=${encodeURIComponent(babyId)}`
}

/** Title and options of the notification for a vaccine push (service worker and open app alike). */
export function vaccineNotification(push: VaccinePush): { title: string; options: NotificationOptions } {
  const url = vaccineVisitUrl(push.babyId, push.visitId)
  const data: VaccineNotificationData = { url, boughtUrl: `${url}&${VACCINE_BOUGHT_PARAM}=yes` }
  const common = {
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    // One per visit: a new day's question replaces yesterday's unanswered one.
    tag: `vaccine-${push.visitId}`,
    data,
  }

  if (push.type === VACCINE_DAY_PUSH) {
    return {
      title: 'Vaccine today',
      options: { ...common, body: `Don't forget to take ${push.babyName}'s vaccine to the pediatrician.` },
    }
  }
  return {
    title: 'Vaccine bought?',
    options: {
      ...common,
      body: `${push.babyName}'s visit on ${formatVisitDate(push.visitDate)}: have you bought the vaccine?`,
      requireInteraction: true,
      // Not shown on every platform (iOS): tapping the notification opens the visit to answer there.
      actions: [
        { action: VACCINE_BOUGHT_ACTION, title: 'Yes' },
        { action: VACCINE_NOT_BOUGHT_ACTION, title: 'No' },
      ],
    } as NotificationOptions,
  }
}
