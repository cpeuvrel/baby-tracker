import { disableNetwork, enableNetwork, type Firestore } from 'firebase/firestore'

/** Time in the background after which the connection is not trusted any more. */
export const RESYNC_AFTER_HIDDEN_MS = 30_000

/**
 * Reconnects Firestore when the app comes back to the foreground after a while.
 *
 * Phones freeze a backgrounded app: its connection can die without the SDK noticing, and the
 * listeners kept open (activity cards, history calendar) then keep showing what they had,
 * missing what was added since — while a screen opened afresh gets the latest. Cycling the
 * network opens a new connection on which every open listener catches up.
 */
export function resyncFirestoreOnForeground(db: Firestore): () => void {
  let hiddenAt: number | null = null
  let resyncing = false

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt
    hiddenAt = null
    if (hiddenFor < RESYNC_AFTER_HIDDEN_MS || resyncing) return
    resyncing = true
    disableNetwork(db)
      .then(() => enableNetwork(db))
      .catch((error: unknown) => console.warn('Firestore resync failed', error))
      .finally(() => {
        resyncing = false
      })
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}
