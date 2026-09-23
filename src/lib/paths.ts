import { collection, type CollectionReference } from 'firebase/firestore'
import { db } from './firebase'

export function householdsCollection() {
  return collection(db, 'households')
}

export function babiesCollection(householdId: string): CollectionReference {
  return collection(db, 'households', householdId, 'babies')
}

export function feedingEntriesCollection(householdId: string, babyId: string): CollectionReference {
  return collection(db, 'households', householdId, 'babies', babyId, 'feedingEntries')
}

export function sleepEntriesCollection(householdId: string, babyId: string): CollectionReference {
  return collection(db, 'households', householdId, 'babies', babyId, 'sleepEntries')
}

export function diaperEntriesCollection(householdId: string, babyId: string): CollectionReference {
  return collection(db, 'households', householdId, 'babies', babyId, 'diaperEntries')
}

export function growthEntriesCollection(householdId: string, babyId: string): CollectionReference {
  return collection(db, 'households', householdId, 'babies', babyId, 'growthEntries')
}

export function medicationEntriesCollection(
  householdId: string,
  babyId: string,
): CollectionReference {
  return collection(db, 'households', householdId, 'babies', babyId, 'medicationEntries')
}

export function remindersCollection(householdId: string, babyId: string): CollectionReference {
  return collection(db, 'households', householdId, 'babies', babyId, 'reminders')
}

export function fcmTokensCollection(uid: string): CollectionReference {
  return collection(db, 'users', uid, 'fcmTokens')
}
