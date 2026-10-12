import { describe, expect, it } from 'vitest'
import { formatVisitDate, todayDateValue } from './visitDate'

describe('visitDate', () => {
  it('formats a calendar day', () => {
    expect(formatVisitDate('2026-10-08')).toBe('Thu, Oct 8, 2026')
  })

  it.each(['garbage', '', '2026-13-01', '2026-02-31', '2026-1-8'])('shows a malformed date as it is: "%s"', (value) => {
    expect(formatVisitDate(value)).toBe(value)
  })

  it("gives today's Paris day", () => {
    // 23:30 UTC on Oct 7 is already Oct 8 in Paris.
    expect(todayDateValue(new Date('2026-10-07T23:30:00.000Z'))).toBe('2026-10-08')
  })
})
