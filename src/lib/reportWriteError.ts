/**
 * A `.catch` for a Firestore write made after its form closed: the parent is told the entry was
 * not saved (permission refused, entry deleted on the other phone…) instead of losing it silently.
 * Offline writes do not reject: the local cache keeps them until the connection is back.
 */
export function reportWriteError(action: string): (error: unknown) => void {
  return (error: unknown) => {
    console.error(error)
    window.alert(`Could not ${action}. Please try again.`)
  }
}
