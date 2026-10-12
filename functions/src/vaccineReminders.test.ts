import { describe, expect, it, vi } from 'vitest'
import { FakeFirestore, recordingSender } from './test/fakeFirestore'
import {
  addDays,
  needsDayReminder,
  needsPurchaseQuestion,
  purchaseQuestionSettled,
  runVaccineDayReminders,
  runVaccinePurchaseQuestions,
} from './vaccineReminders'

vi.mock('firebase-functions', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

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
})

describe('purchaseQuestionSettled', () => {
  const asked = visit('2026-10-11')

  it('settles when someone says the vaccine is bought', () => {
    expect(purchaseQuestionSettled(asked, { ...asked, vaccineBought: true })).toBe(true)
  })

  it('settles when the vaccine is dropped or the visit deleted', () => {
    expect(purchaseQuestionSettled(asked, { ...asked, vaccinated: false })).toBe(true)
    expect(purchaseQuestionSettled(asked, undefined)).toBe(true)
  })

  it('ignores other edits', () => {
    expect(purchaseQuestionSettled(asked, { ...asked, date: '2026-10-12' })).toBe(false)
    expect(purchaseQuestionSettled(undefined, asked)).toBe(false)
    const bought = { ...asked, vaccineBought: true }
    expect(purchaseQuestionSettled(bought, { ...bought, date: '2026-10-12' })).toBe(false)
  })
})

describe('vaccine reminder runs', () => {
  const today = '2026-10-09'
  const household = 'households/h1'

  function setUp() {
    return new FakeFirestore({
      [household]: { memberUids: ['u1'] },
      [`${household}/babies/b1`]: { name: 'Léo' },
      [`${household}/babies/b1/pediatricianVisits/v1`]: { date: '2026-10-11', vaccinated: true },
      [`${household}/babies/b1/pediatricianVisits/v2`]: { date: '2026-10-12', vaccinated: false },
      [`${household}/babies/b1/pediatricianVisits/v3`]: { date: '2026-10-09', vaccinated: true, vaccineBought: true },
      [`${household}/babies/b2`]: {},
      [`${household}/babies/b2/pediatricianVisits/v4`]: { date: '2026-10-10', vaccinated: true },
    })
  }

  it('asks about the purchase for each upcoming vaccine visit not bought yet', async () => {
    const { sent, send } = recordingSender()

    await runVaccinePurchaseQuestions(setUp().asFirestore(), today, send)

    expect(sent).toEqual([
      {
        household,
        data: { type: 'vaccine-purchase', babyId: 'b1', babyName: 'Léo', visitId: 'v1', visitDate: '2026-10-11' },
        ttlSeconds: 6 * 60 * 60,
      },
      {
        household,
        data: { type: 'vaccine-purchase', babyId: 'b2', babyName: 'Baby', visitId: 'v4', visitDate: '2026-10-10' },
        ttlSeconds: 6 * 60 * 60,
      },
    ])
  })

  it('reminds on the day of the visit', async () => {
    const { sent, send } = recordingSender()

    await runVaccineDayReminders(setUp().asFirestore(), today, send)

    expect(sent.map(({ data }) => [data.type, data.visitId])).toEqual([['vaccine-day', 'v3']])
  })

  it('still asks for the other babies when one of them fails', async () => {
    const db = setUp()
    db.failOn = (path) => path === `${household}/babies/b1/pediatricianVisits`
    const { sent, send } = recordingSender()

    await runVaccinePurchaseQuestions(db.asFirestore(), today, send)

    expect(sent.map(({ data }) => data.visitId)).toEqual(['v4'])
  })
})
