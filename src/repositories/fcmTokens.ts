import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { fcmTokensCollection } from '../lib/paths'

/**
 * Records this device's token, or that it was seen again: the server skips
 * (and deletes) the tokens not seen for 60 days (functions/src/tokens.ts).
 * `createdAt` stays the first registration.
 */
export async function saveFcmToken(uid: string, token: string): Promise<void> {
  const tokenRef = doc(fcmTokensCollection(uid), token)
  const now = Timestamp.now()
  const known = (await getDoc(tokenRef)).exists()
  await setDoc(tokenRef, known ? { token, lastSeenAt: now } : { token, createdAt: now, lastSeenAt: now }, {
    merge: true,
  })
}

/** Forgets this device's token (sign-out): needs the owner still signed in. */
export async function deleteFcmToken(uid: string, token: string): Promise<void> {
  await deleteDoc(doc(fcmTokensCollection(uid), token))
}
