import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

/**
 * Runs `task` for every baby of every household. Each baby is isolated: an
 * error (a failed query, a failed send) is logged and the other babies still
 * get their turn, instead of the whole scheduler run stopping there.
 */
export async function forEachBaby(
  db: Firestore,
  label: string,
  task: (household: QueryDocumentSnapshot, baby: QueryDocumentSnapshot) => Promise<void>,
): Promise<void> {
  const households = await db.collection('households').get()
  for (const household of households.docs) {
    let babies
    try {
      babies = await household.ref.collection('babies').get()
    } catch (error) {
      logger.error(`${label}: could not list the babies`, { householdId: household.id, error })
      continue
    }
    for (const baby of babies.docs) {
      try {
        await task(household, baby)
      } catch (error) {
        logger.error(`${label} failed`, { householdId: household.id, babyId: baby.id, error })
      }
    }
  }
}

/** The baby's first name as the notifications show it. */
export function babyNameOf(baby: { data(): Record<string, unknown> | undefined }): string {
  const name = baby.data()?.name
  return typeof name === 'string' && name !== '' ? name : 'Baby'
}
