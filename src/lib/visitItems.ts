/** Id for a remark or question kept inside a visit document. */
export function newItemId(): string {
  // `crypto.randomUUID` only exists in a secure context: not on http://192.168.x.x in dev.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

interface VisitItem {
  id: string
}

// Changes to a visit's remarks or questions, applied to their latest stored list (see
// `mutateVisitItems`): they touch one item only, so the other parent's concurrent changes stay.

/** Changes the item `id` (gone already: nothing to change). */
export function editItem<T extends VisitItem>(id: string, changes: Partial<Omit<T, 'id'>>): (items: T[]) => T[] {
  return (items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item))
}

/** Removes the item `id`. */
export function removeItem<T extends VisitItem>(id: string): (items: T[]) => T[] {
  return (items) => items.filter((item) => item.id !== id)
}
