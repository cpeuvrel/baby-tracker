import { queryEqual, type Query } from 'firebase/firestore'
import { expect } from 'vitest'

/** The SDK's internal description of a query: only used to print a readable diff. */
function describeQuery(value: unknown): unknown {
  return (value as { _query?: unknown } | null)?._query ?? value
}

/** Asserts that a query received by a mocked `onSnapshot`/`getDocs` is the expected one. */
export function expectQuery(received: unknown, expected: Query): void {
  const equal = queryEqual(received as Query, expected)
  if (!equal) {
    // Fails with a diff of the two query descriptions (filters, order, limit).
    expect(describeQuery(received)).toEqual(describeQuery(expected))
  }
  expect(equal).toBe(true)
}
