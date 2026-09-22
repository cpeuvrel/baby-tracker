import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { nullableTimestampToIso, timestampToIso } from './firestoreDates'

describe('timestampToIso', () => {
  it('converts a Firestore Timestamp to an ISO string', () => {
    const timestamp = Timestamp.fromDate(new Date('2026-03-05T10:00:00.000Z'))

    expect(timestampToIso(timestamp)).toBe('2026-03-05T10:00:00.000Z')
  })
})

describe('nullableTimestampToIso', () => {
  it('returns null when given null or undefined', () => {
    expect(nullableTimestampToIso(null)).toBeNull()
    expect(nullableTimestampToIso(undefined)).toBeNull()
  })

  it('converts a present Timestamp', () => {
    const timestamp = Timestamp.fromDate(new Date('2026-03-05T10:00:00.000Z'))

    expect(nullableTimestampToIso(timestamp)).toBe('2026-03-05T10:00:00.000Z')
  })
})
