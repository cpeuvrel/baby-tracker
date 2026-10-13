import type { DocumentReference } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

export interface HouseholdToken {
  token: string
  ref: DocumentReference
}

export type TokenLoader = (householdRef: DocumentReference) => Promise<HouseholdToken[]>

/**
 * A device not seen for this long is most likely abandoned (FCM's own advice):
 * its token still "works", so no send error would ever clean it up.
 */
export const STALE_TOKEN_DAYS = 60
const STALE_TOKEN_MS = STALE_TOKEN_DAYS * 24 * 60 * 60 * 1000

interface TokenFields {
  lastSeenAt?: { toMillis(): number }
  // Tokens saved before `lastSeenAt` existed: rewritten at every session, so a last-seen date too.
  createdAt?: { toMillis(): number }
}

/** FCM tokens of every device of every member of the household; drops the stale ones. */
export async function collectHouseholdTokens(
  householdRef: DocumentReference,
  now: Date = new Date(),
): Promise<HouseholdToken[]> {
  const householdSnap = await householdRef.get()
  const memberUids = (householdSnap.data()?.memberUids as string[] | undefined) ?? []

  const tokens: HouseholdToken[] = []
  const stale: DocumentReference[] = []
  for (const uid of memberUids) {
    const tokensSnap = await householdRef.firestore.collection('users').doc(uid).collection('fcmTokens').get()
    for (const doc of tokensSnap.docs) {
      const fields = doc.data() as TokenFields
      const seenAt = (fields.lastSeenAt ?? fields.createdAt)?.toMillis()
      if (seenAt != null && now.getTime() - seenAt > STALE_TOKEN_MS) stale.push(doc.ref)
      else tokens.push({ token: doc.id, ref: doc.ref })
    }
  }

  const deletions = await Promise.allSettled(stale.map((ref) => ref.delete()))
  for (const result of deletions) {
    if (result.status === 'rejected') logger.warn('Could not delete a stale FCM token', { error: result.reason })
  }
  return tokens
}

/**
 * Reads each household's tokens once, however many pushes it gets: one per
 * scheduler run, so a device registered in the meantime is picked up next run.
 */
export function memoizeTokenLoader(load: TokenLoader): TokenLoader {
  const cache = new Map<string, Promise<HouseholdToken[]>>()
  return (householdRef) => {
    let tokens = cache.get(householdRef.path)
    if (!tokens) {
      tokens = load(householdRef)
      // A failed read is retried by the next push rather than failing them all.
      tokens.catch(() => cache.delete(householdRef.path))
      cache.set(householdRef.path, tokens)
    }
    return tokens
  }
}
