/** Tells why a sleep did not start: firestore.rules refused it as another one runs. */
export function alertSleepAlreadyRunning(): void {
  window.alert('Another sleep timer is already running.')
}

/**
 * Tells why a sleep write failed. Only a write that takes the sleep timer lock (a start, a
 * resume, an edit that clears the end) can be refused because another sleep runs: any other
 * failure (expired session, invalid data, network) gets the generic message.
 */
export function alertSleepWriteFailed(error: unknown, lockInvolved: boolean): void {
  const code = (error as { code?: unknown } | null)?.code
  if (lockInvolved && code === 'permission-denied') {
    alertSleepAlreadyRunning()
    return
  }
  console.error(error)
  window.alert('Could not save this sleep. Please try again.')
}
