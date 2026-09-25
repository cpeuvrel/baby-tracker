import { doc, getDocs, writeBatch, type CollectionReference } from 'firebase/firestore'
import { db } from './firebase'

const MAX_BATCH_SIZE = 450

export async function batchInsert<T>(
  collectionRef: CollectionReference,
  items: T[],
  toDocData: (item: T) => Record<string, unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
    const chunk = items.slice(i, i + MAX_BATCH_SIZE)
    const batch = writeBatch(db)
    for (const item of chunk) {
      batch.set(doc(collectionRef), toDocData(item))
    }
    await batch.commit()
  }
}

/** Deletes every document in a collection, returning how many were removed. */
export async function batchDeleteAll(collectionRef: CollectionReference): Promise<number> {
  const snapshot = await getDocs(collectionRef)
  for (let i = 0; i < snapshot.docs.length; i += MAX_BATCH_SIZE) {
    const chunk = snapshot.docs.slice(i, i + MAX_BATCH_SIZE)
    const batch = writeBatch(db)
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref)
    }
    await batch.commit()
  }
  return snapshot.docs.length
}
