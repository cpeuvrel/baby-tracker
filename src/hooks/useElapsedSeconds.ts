import { useEffect, useState } from 'react'
import { secondsBetween } from '../lib/duration'

export function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      // oxlint-disable-next-line react/set-state-in-effect -- resets the counter as soon as the timer stops, without a render showing the old value
      setElapsed(0)
      return
    }
    const start = new Date(startedAt)
    setElapsed(secondsBetween(start, new Date()))
    const interval = setInterval(() => {
      setElapsed(secondsBetween(start, new Date()))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return elapsed
}
