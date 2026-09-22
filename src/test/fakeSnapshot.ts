import type { DocumentData, QuerySnapshot } from 'firebase/firestore'

export function fakeSnapshot(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
): QuerySnapshot<DocumentData> {
  return {
    docs: docs.map((entry) => ({ id: entry.id, data: () => entry.data })),
  } as unknown as QuerySnapshot<DocumentData>
}
