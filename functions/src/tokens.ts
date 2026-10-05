import type { DocumentReference } from 'firebase-admin/firestore'

export interface HouseholdToken {
  token: string
  ref: DocumentReference
}

/** FCM tokens of every device of every member of the household. */
export async function collectHouseholdTokens(householdRef: DocumentReference): Promise<HouseholdToken[]> {
  const householdSnap = await householdRef.get()
  const memberUids = (householdSnap.data()?.memberUids as string[] | undefined) ?? []

  const tokens: HouseholdToken[] = []
  for (const uid of memberUids) {
    const tokensSnap = await householdRef.firestore.collection('users').doc(uid).collection('fcmTokens').get()
    tokens.push(...tokensSnap.docs.map((doc) => ({ token: doc.id, ref: doc.ref })))
  }
  return tokens
}
