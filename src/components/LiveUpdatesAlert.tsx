/**
 * Shown when a Firestore listener failed: it stopped for good, so what the screen shows is no
 * longer updated (and may be empty). Reloading subscribes again.
 */
export function LiveUpdatesAlert() {
  return (
    <p role="alert">
      Live updates stopped —{' '}
      <button type="button" className="link-button" onClick={() => window.location.reload()}>
        reload
      </button>
    </p>
  )
}
