import { describe, expect, it } from 'vitest'
import { formatVisitDate, todayDateValue } from './visitDate'

describe('visitDate', () => {
  it('formats a calendar day', () => {
    expect(formatVisitDate('2026-10-08')).toBe('Thu, Oct 8, 2026')
  })

  it("gives today's Paris day", () => {
    // 23:30 UTC on Oct 7 is already Oct 8 in Paris.
    expect(todayDateValue(new Date('2026-10-07T23:30:00.000Z'))).toBe('2026-10-08')
  })
})
