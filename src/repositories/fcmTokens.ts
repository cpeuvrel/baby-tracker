import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { fcmTokensCollection } from '../lib/paths'

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(fcmTokensCollection(uid), token), {
    token,
    createdAt: Timestamp.now(),
  })
}
