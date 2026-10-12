import { deleteField, doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { fcmTokensCollection } from '../lib/paths'

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(fcmTokensCollection(uid), token), {
    token,
    createdAt: Timestamp.now(),
  })
}

/** The running sleep's notification was swiped away on this device: the server refreshes it again. */
export async function clearSleepTimerMute(uid: string, token: string): Promise<void> {
  await updateDoc(doc(fcmTokensCollection(uid), token), { mutedSleepEntryId: deleteField() })
}
