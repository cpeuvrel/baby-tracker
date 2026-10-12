import { Timestamp } from 'firebase-admin/firestore'
import { describe, expect, it, vi } from 'vitest'
import { medicationMatches, runMedicationCheck, shouldSendReminder } from './medicationReminders'
import { FakeFirestore, recordingSender } from './test/fakeFirestore'

vi.mock('firebase-functions', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

describe('shouldSendReminder', () => {
  const reminder = (timeOfDay: string, lastSentOn?: string) => ({ timeOfDay, lastSentOn })

  it('is due once the reminder time has passed today (Paris time)', () => {
    // 09:00 in Paris = 08:00 UTC in winter, 07:00 UTC in summer.
    expect(shouldSendReminder(reminder('09:00'), new Date('2026-01-15T07:59:00Z'), '2026-01-15')).toBe(false)
    expect(shouldSendReminder(reminder('09:00'), new Date('2026-01-15T08:00:00Z'), '2026-01-15')).toBe(true)
    expect(shouldSendReminder(reminder('09:00'), new Date('2026-07-01T07:05:00Z'), '2026-07-01')).toBe(true)
  })

  it('catches up later in the day when a run was missed', () => {
    expect(shouldSendReminder(reminder('09:00'), new Date('2026-01-15T14:00:00Z'), '2026-01-15')).toBe(true)
  })

  it('is not due again once sent today, but is the next day', () => {
    expect(shouldSendReminder(reminder('09:00', '2026-01-15'), new Date('2026-01-15T08:15:00Z'), '2026-01-15')).toBe(
      false,
    )
    expect(shouldSendReminder(reminder('09:00', '2026-01-15'), new Date('2026-01-16T08:00:00Z'), '2026-01-16')).toBe(
      true,
    )
  })

  it('handles a reminder late in the evening', () => {
    // 23:55 in Paris (winter).
    expect(shouldSendReminder(reminder('23:50'), new Date('2026-01-15T22:55:00Z'), '2026-01-15')).toBe(true)
    expect(shouldSendReminder(reminder('23:50'), new Date('2026-01-15T22:45:00Z'), '2026-01-15')).toBe(false)
  })

  it('sends the 02:30 reminder only once when clocks go back (02:30 happens twice)', () => {
    const today = '2026-10-25'
    expect(shouldSendReminder(reminder('02:30'), new Date('2026-10-25T00:30:00Z'), today)).toBe(true)
    // The second 02:30, once the first one sent it.
    expect(shouldSendReminder(reminder('02:30', today), new Date('2026-10-25T01:30:00Z'), today)).toBe(false)
  })

  it('still sends the 02:30 reminder when clocks go forward (02:30 never happens)', () => {
    // 01:00Z is 03:00 in Paris, right after the jump.
    expect(shouldSendReminder(reminder('02:30'), new Date('2026-03-29T00:45:00Z'), '2026-03-29')).toBe(false)
    expect(shouldSendReminder(reminder('02:30'), new Date('2026-03-29T01:00:00Z'), '2026-03-29')).toBe(true)
  })
})

describe('medicationMatches', () => {
  it('counts any name starting like the reminder, as the app does', () => {
    expect(medicationMatches('Vitamin D', 'Vitamin D')).toBe(true)
    expect(medicationMatches(' vitamin d', 'Vitamin D')).toBe(true)
    expect(medicationMatches('Vitamine D', 'Vitamin D')).toBe(true)
    expect(medicationMatches('Vitamin/Probiotic', 'Vitamin D')).toBe(true)
    expect(medicationMatches('Paracetamol', 'Vitamin D')).toBe(false)
  })
})

describe('runMedicationCheck', () => {
  // 10:00 in Paris, winter.
  const now = new Date('2026-01-15T09:00:00Z')
  const household = 'households/h1'
  const reminderAt = (timeOfDay: string, extra: Record<string, unknown> = {}) => ({
    medicationName: 'Vitamin D',
    timeOfDay,
    active: true,
    ...extra,
  })
  const dose = (name: string, iso: string) => ({ name, givenAt: Timestamp.fromDate(new Date(iso)) })

  function setUp(extraDocs: Record<string, Record<string, unknown>> = {}) {
    return new FakeFirestore({
      [household]: { memberUids: ['u1'] },
      [`${household}/babies/b1`]: { name: 'Léo' },
      [`${household}/babies/b1/reminders/Vitamin D`]: reminderAt('09:00'),
      ...extraDocs,
    })
  }

  it('sends a data-only reminder when the vitamin was not given today, then marks the day', async () => {
    const db = setUp({
      // Yesterday's dose (23:30 Paris) doesn't count.
      [`${household}/babies/b1/medicationEntries/m1`]: dose('Vitamin D', '2026-01-14T22:30:00Z'),
    })
    const { sent, send } = recordingSender()

    await runMedicationCheck(db.asFirestore(), now, send)

    expect(sent).toEqual([
      { household, data: { type: 'medication-reminder', medicationName: 'Vitamin D' }, ttlSeconds: 6 * 60 * 60 },
    ])
    expect(db.docs.get(`${household}/babies/b1/reminders/Vitamin D`)).toMatchObject({ lastSentOn: '2026-01-15' })
  })

  it('sends it only once a day', async () => {
    const db = setUp()
    const { sent, send } = recordingSender()

    await runMedicationCheck(db.asFirestore(), now, send)
    await runMedicationCheck(db.asFirestore(), new Date('2026-01-15T09:15:00Z'), send)

    expect(sent).toHaveLength(1)
  })

  it('does not send it when a matching dose was logged today', async () => {
    const db = setUp({
      [`${household}/babies/b1/medicationEntries/m1`]: dose('Vitamin/Probiotic', '2026-01-15T07:00:00Z'),
    })
    const { sent, send } = recordingSender()

    await runMedicationCheck(db.asFirestore(), now, send)

    expect(sent).toEqual([])
    expect(db.docs.get(`${household}/babies/b1/reminders/Vitamin D`)).toMatchObject({ lastSentOn: '2026-01-15' })
  })

  it('skips inactive reminders and reminders not due yet', async () => {
    const db = setUp({
      [`${household}/babies/b1/reminders/Vitamin D`]: reminderAt('11:00'),
      [`${household}/babies/b1/reminders/Iron`]: { ...reminderAt('08:00'), medicationName: 'Iron', active: false },
    })
    const { sent, send } = recordingSender()

    await runMedicationCheck(db.asFirestore(), now, send)

    expect(sent).toEqual([])
  })

  it('still reminds the other babies when one of them fails', async () => {
    const db = setUp({
      [`${household}/babies/b0`]: { name: 'Maëlys' },
      [`${household}/babies/b0/reminders/Vitamin D`]: reminderAt('09:00'),
    })
    // b1 comes first and fails.
    db.failOn = (path) => path === `${household}/babies/b1/medicationEntries`
    const { sent, send } = recordingSender()

    await runMedicationCheck(db.asFirestore(), now, send)

    expect(sent).toHaveLength(1)
    expect(db.docs.get(`${household}/babies/b0/reminders/Vitamin D`)).toMatchObject({ lastSentOn: '2026-01-15' })
    // The failed one is tried again at the next run.
    expect(db.docs.get(`${household}/babies/b1/reminders/Vitamin D`)).not.toHaveProperty('lastSentOn')
  })

  it('tries again at the next run when the send fails', async () => {
    const db = setUp()
    const send = vi.fn().mockRejectedValue(new Error('FCM down'))

    await runMedicationCheck(db.asFirestore(), now, send)

    expect(send).toHaveBeenCalledTimes(1)
    expect(db.docs.get(`${household}/babies/b1/reminders/Vitamin D`)).not.toHaveProperty('lastSentOn')
  })
})
