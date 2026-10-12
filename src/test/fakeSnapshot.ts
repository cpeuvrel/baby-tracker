import type { DocumentData, QuerySnapshot } from 'firebase/firestore'

interface FakeSnapshotOptions {
  /** As Firestore reports a snapshot served from the local cache (e.g. an offline start). */
  fromCache?: boolean
  hasPendingWrites?: boolean
}

/** A `QuerySnapshot` stand-in modelling what the repositories may read from a real one. */
export function fakeSnapshot(
  entries: Array<{ id: string; data: Record<string, unknown> }>,
  { fromCache = false, hasPendingWrites = false }: FakeSnapshotOptions = {},
): QuerySnapshot<DocumentData> {
  const docs = entries.map((entry) => ({
    id: entry.id,
    ref: { id: entry.id, path: `fake/${entry.id}` },
    exists: () => true,
    // Firestore hands out a fresh copy on every call.
    data: () => ({ ...entry.data }),
  }))
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (callback: (doc: (typeof docs)[number]) => void) => docs.forEach(callback),
    docChanges: () => docs.map((doc, newIndex) => ({ type: 'added', doc, oldIndex: -1, newIndex })),
    metadata: { fromCache, hasPendingWrites, isEqual: () => true },
  } as unknown as QuerySnapshot<DocumentData>
}
