import { useCallback, useRef, useState } from 'react'

export interface AsyncAction {
  /**
   * Runs `action` unless one is already running (a double tap runs it once). Resolves to
   * whether it succeeded; a failure is logged and described in `error`, never rethrown.
   */
  run: (action: () => Promise<unknown>) => Promise<boolean>
  /** True while the action runs: disable its button. */
  pending: boolean
  /** What to show (in a `role="alert"`) after the last run failed, otherwise null. */
  error: string | null
}

/** A save (or delete) that the user waits for: one at a time, with its failure shown. */
export function useAsyncAction(errorMessage = 'Could not save. Try again.'): AsyncAction {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // State is only updated on the next render: two taps in a row would both see `pending` false.
  const running = useRef(false)

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      if (running.current) return false
      running.current = true
      setPending(true)
      setError(null)
      try {
        await action()
        return true
      } catch (cause) {
        console.error('[action] failed', cause)
        setError(errorMessage)
        return false
      } finally {
        running.current = false
        setPending(false)
      }
    },
    [errorMessage],
  )

  return { run, pending, error }
}
