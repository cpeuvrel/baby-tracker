import type { DocumentReference } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { collectHouseholdTokens, memoizeTokenLoader, type TokenLoader } from './tokens'

const UNREGISTERED_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/** Sends one data-only push to a household: what the schedulers and triggers are given. */
export type HouseholdSender = (
  householdRef: DocumentReference,
  data: Record<string, string>,
  ttlSeconds: number,
) => Promise<void>

/**
 * Data-only push to every device of the household: the service worker builds
 * the notification itself (src/lib/backgroundPush.ts). Past `ttlSeconds` an undelivered push is dropped.
 */
export async function sendToHousehold(
  householdRef: DocumentReference,
  data: Record<string, string>,
  ttlSeconds: number,
  loadTokens: TokenLoader = collectHouseholdTokens,
): Promise<void> {
  const tokens = await loadTokens(householdRef)
  if (tokens.length === 0) return

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(({ token }) => token),
    data,
    webpush: { headers: { Urgency: 'high', TTL: String(ttlSeconds) } },
  })

  // Uninstalled apps and cleared browsers: stop pushing to them. The push itself
  // went out, so a failed clean-up is only logged (it is tried again at the next push).
  const deletions = await Promise.allSettled(
    response.responses.map((result, index) =>
      result.error && UNREGISTERED_TOKEN_CODES.has(result.error.code) ? tokens[index].ref.delete() : null,
    ),
  )
  for (const result of deletions) {
    if (result.status === 'rejected') logger.warn('Could not delete an unregistered FCM token', { error: result.reason })
  }
}

/** A sender for one scheduler run: each household's tokens are read once for the whole run. */
export function senderForRun(): HouseholdSender {
  const loadTokens = memoizeTokenLoader(collectHouseholdTokens)
  return (householdRef, data, ttlSeconds) => sendToHousehold(householdRef, data, ttlSeconds, loadTokens)
}
