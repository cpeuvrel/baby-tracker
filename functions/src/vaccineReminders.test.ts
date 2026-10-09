import { describe, expect, it } from 'vitest'
import { addDays, needsDayReminder, needsPurchaseQuestion, parisDateValue } from './vaccineReminders'

const visit = (date: string, overrides: { vaccinated?: boolean; vaccineBought?: boolean } = {}) => ({
  date,
  vaccinated: true,
  ...overrides,
})

describe('needsPurchaseQuestion', () => {
  it('asks from 4 days before the visit until the day before', () => {
    const today = '2026-10-09'
    expect(needsPurchaseQuestion(visit('2026-10-14'), today)).toBe(false)
    expect(needsPurchaseQuestion(visit('2026-10-13'), today)).toBe(true)
    expect(needsPurchaseQuestion(visit('2026-10-10'), today)).toBe(true)
    expect(needsPurchaseQuestion(visit('2026-10-09'), today)).toBe(false)
  })

  it('stops once the vaccine is bought', () => {
    expect(needsPurchaseQuestion(visit('2026-10-11', { vaccineBought: true }), '2026-10-09')).toBe(false)
    expect(needsPurchaseQuestion(visit('2026-10-11', { vaccineBought: false }), '2026-10-09')).toBe(true)
  })

  it('ignores visits without a vaccine', () => {
    expect(needsPurchaseQuestion(visit('2026-10-11', { vaccinated: false }), '2026-10-09')).toBe(false)
  })

  it('counts days across month ends', () => {
    expect(needsPurchaseQuestion(visit('2026-11-02'), '2026-10-29')).toBe(true)
    expect(needsPurchaseQuestion(visit('2026-11-03'), '2026-10-29')).toBe(false)
  })
})

describe('needsDayReminder', () => {
  it('reminds on the day of a vaccine visit, bought or not', () => {
    expect(needsDayReminder(visit('2026-10-09'), '2026-10-09')).toBe(true)
    expect(needsDayReminder(visit('2026-10-09', { vaccineBought: true }), '2026-10-09')).toBe(true)
    expect(needsDayReminder(visit('2026-10-10'), '2026-10-09')).toBe(false)
    expect(needsDayReminder(visit('2026-10-09', { vaccinated: false }), '2026-10-09')).toBe(false)
  })
})

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 4)).toBe('2027-01-03')
    expect(addDays('2026-02-26', 4)).toBe('2026-03-02')
  })

  it('reads today in Paris', () => {
    expect(parisDateValue(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
    expect(parisDateValue(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
  })
})
