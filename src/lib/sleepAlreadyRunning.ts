/** Tells why a sleep did not start: firestore.rules refused it as another one runs. */
export function alertSleepAlreadyRunning(): void {
  window.alert('Another sleep timer is already running.')
}
