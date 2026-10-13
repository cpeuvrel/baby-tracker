// @vitest-environment node
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

describe('timestampToIso on documents not written by the app', () => {
  it('accepts a Date', () => {
    expect(timestampToIso(new Date('2026-03-05T10:00:00.000Z'))).toBe('2026-03-05T10:00:00.000Z')
  })

  it('accepts an ISO string', () => {
    expect(timestampToIso('2026-03-05T11:00:00+01:00')).toBe('2026-03-05T10:00:00.000Z')
  })

  it.each([undefined, null, 'not a date', 42, {}, new Date('invalid')])('throws on %s', (value) => {
    expect(() => timestampToIso(value)).toThrow('Not a Firestore timestamp')
  })

  it('throws on a malformed value even when nullable', () => {
    expect(() => nullableTimestampToIso('nope')).toThrow('Not a Firestore timestamp')
  })
})
