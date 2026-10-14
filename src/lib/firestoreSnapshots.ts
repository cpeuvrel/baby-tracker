import type { DocumentData, FirestoreError, QuerySnapshot } from 'firebase/firestore'

/**
 * Maps every document of a snapshot, skipping (with a warning) those `toModel` cannot read:
 * one malformed document must not throw inside the listener and freeze the whole list.
 */
export function mapDocs<T>(
  snapshot: QuerySnapshot<DocumentData>,
  toModel: (id: string, data: DocumentData) => T,
): T[] {
  const models: T[] = []
  for (const docSnap of snapshot.docs) {
    try {
      // A time the server is still to stamp (e.g. a sleep just stopped) reads as its local estimate.
      models.push(toModel(docSnap.id, docSnap.data({ serverTimestamps: 'estimate' })))
    } catch (error) {
      console.warn('[firestore] skipping malformed document', docSnap.ref?.path ?? docSnap.id, error)
    }
  }
  return models
}

/**
 * The error callback of a listener: Firestore stops a listener for good after an error
 * (rules refusal, missing index…), so it is logged and handed to the caller to show.
 */
export function listenerErrorHandler(
  label: string,
  onError: ((error: Error) => void) | undefined,
): (error: FirestoreError) => void {
  return (error) => {
    console.error(`[firestore] ${label} listener failed`, error)
    onError?.(error)
  }
}
