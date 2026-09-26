import { useEffect, useState } from 'react'

const DEFAULT_INTERVAL_MS = 30_000

/**
 * The current time, refreshed every `intervalMs` and as soon as the page becomes
 * visible again (phones pause timers while the app is in the background).
 */
export function useNow(intervalMs: number = DEFAULT_INTERVAL_MS): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const interval = setInterval(refresh, intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs])

  return now
}
