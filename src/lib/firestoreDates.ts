import { Timestamp } from 'firebase/firestore'

/**
 * A stored date as an ISO string. Documents written by the app hold a `Timestamp`, but one
 * created by hand in the console, a seed script or an older version may hold a `Date` or an
 * ISO string: those are accepted too. Anything else throws, so the caller can skip the document.
 */
export function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  throw new Error(`Not a Firestore timestamp: ${String(value)}`)
}

export function nullableTimestampToIso(value: unknown): string | null {
  return value == null ? null : timestampToIso(value)
}
