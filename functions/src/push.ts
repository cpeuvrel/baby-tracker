import type { DocumentReference } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { collectHouseholdTokens } from './tokens'

const UNREGISTERED_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/**
 * Data-only push to every device of the household: the service worker builds
 * the notification itself (src/sw.ts). Past `ttlSeconds` an undelivered push is dropped.
 */
export async function sendToHousehold(
  householdRef: DocumentReference,
  data: Record<string, string>,
  ttlSeconds: number,
): Promise<void> {
  const tokens = await collectHouseholdTokens(householdRef)
  if (tokens.length === 0) return

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(({ token }) => token),
    data,
    webpush: { headers: { Urgency: 'high', TTL: String(ttlSeconds) } },
  })

  // Uninstalled apps and cleared browsers: stop pushing to them.
  await Promise.all(
    response.responses.map((result, index) =>
      result.error && UNREGISTERED_TOKEN_CODES.has(result.error.code) ? tokens[index].ref.delete() : null,
    ),
  )
}
