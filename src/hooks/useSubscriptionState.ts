import type { Unsubscribe } from 'firebase/firestore'
import { useEffect, useState } from 'react'

/** What a live Firestore subscription currently knows. */
export interface SubscriptionState<T> {
  data: T
  /** True until the first snapshot (or error) of the current subscription. */
  loading: boolean
  /** Set when the listener failed: Firestore stops it for good, `data` is no longer updated. */
  error: Error | null
}

export type Subscribe<T> = (onNext: (data: T) => void, onError: (error: Error) => void) => Unsubscribe

interface Received<T> {
  key: string
  data: T | undefined
  error: Error | null
}

/**
 * Follows the subscription named by `key` (null: nothing to follow, e.g. no baby selected).
 * `subscribe` is called again only when `key` changes, so the key must name everything the
 * subscription depends on. What an earlier key received is never returned: switching baby
 * shows `empty` while loading, not the previous baby's data, and a late callback of a closed
 * subscription is ignored.
 */
export function useSubscriptionState<T>(
  key: string | null,
  subscribe: Subscribe<T>,
  empty: T,
): SubscriptionState<T> {
  const [received, setReceived] = useState<Received<T> | null>(null)

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    const unsubscribe = subscribe(
      (data) => {
        if (!cancelled) setReceived({ key, data, error: null })
      },
      (error) => {
        if (cancelled) return
        // Keep what was last received: it is stale, and `error` says so.
        setReceived((previous) => ({ key, data: previous?.key === key ? previous.data : undefined, error }))
      },
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
    // `key` names the subscription: a new `subscribe` closure for the same key is the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (key === null) return { data: empty, loading: false, error: null }
  if (received?.key !== key) return { data: empty, loading: true, error: null }
  return { data: received.data ?? empty, loading: false, error: received.error }
}
