import { Timestamp } from 'firebase/firestore'

export function timestampToIso(value: Timestamp): string {
  return value.toDate().toISOString()
}

export function nullableTimestampToIso(value: Timestamp | null | undefined): string | null {
  return value ? value.toDate().toISOString() : null
}
