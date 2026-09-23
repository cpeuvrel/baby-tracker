import { doc, writeBatch, type CollectionReference } from 'firebase/firestore'
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
