import { Timestamp } from 'firebase-admin/firestore'
import { describe, expect, it, vi } from 'vitest'
import { handleSleepEntryWrite, runSleepTick, sleepChange, STOP_TTL_SECONDS, TICK_TTL_SECONDS } from './sleepTimer'
import { FakeDocRef, FakeDocSnapshot, FakeFirestore, recordingSender } from './test/fakeFirestore'

vi.mock('firebase-functions', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const at = (iso: string) => ({ toDate: () => new Date(iso) })
const running = (start: string) => ({ startedAt: at(start), endedAt: null })
const stopped = (start: string) => ({ startedAt: at(start), endedAt: at('2026-03-05T22:00:00Z') })

describe('sleepChange', () => {
  it('sees a timer start, or a stopped sleep resumed', () => {
    expect(sleepChange(undefined, running('2026-03-05T20:00:00Z'))).toBe('started')
    expect(sleepChange(stopped('2026-03-05T20:00:00Z'), running('2026-03-05T20:00:00Z'))).toBe('started')
  })

  it('sees a running timer stop or get deleted', () => {
    expect(sleepChange(running('2026-03-05T20:00:00Z'), stopped('2026-03-05T20:00:00Z'))).toBe('stopped')
    expect(sleepChange(running('2026-03-05T20:00:00Z'), undefined)).toBe('stopped')
  })

  it('sees the start of a running timer move', () => {
    expect(sleepChange(running('2026-03-05T20:00:00Z'), running('2026-03-05T19:30:00Z'))).toBe('moved')
  })

  it('ignores other edits and finished sleeps', () => {
    expect(sleepChange(running('2026-03-05T20:00:00Z'), running('2026-03-05T20:00:00Z'))).toBeNull()
    expect(sleepChange(undefined, stopped('2026-03-05T20:00:00Z'))).toBeNull()
    expect(sleepChange(stopped('2026-03-05T20:00:00Z'), stopped('2026-03-05T19:00:00Z'))).toBeNull()
  })
})

const ts = (iso: string) => Timestamp.fromDate(new Date(iso))
const household = 'households/h1'
const sleeps = `${household}/babies/b1/sleepEntries`

describe('runSleepTick', () => {
  it('sends one push per baby whose sleep runs, with its earliest start', async () => {
    const db = new FakeFirestore({
      [household]: {},
      [`${household}/babies/b1`]: { name: 'Léo' },
      // The same sleep started on two devices.
      [`${sleeps}/s1`]: { startedAt: ts('2026-03-05T20:01:00Z'), endedAt: null },
      [`${sleeps}/s2`]: { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: null },
      [`${sleeps}/s0`]: { startedAt: ts('2026-03-05T12:00:00Z'), endedAt: ts('2026-03-05T13:00:00Z') },
      [`${household}/babies/b2`]: { name: 'Maëlys' },
      [`${household}/babies/b2/sleepEntries/s3`]: { startedAt: ts('2026-03-05T19:00:00Z'), endedAt: null },
      [`${household}/babies/b3`]: { name: 'Awake' },
    })
    const { sent, send } = recordingSender()

    await runSleepTick(db.asFirestore(), send)

    expect(sent).toEqual([
      {
        household,
        data: { type: 'sleep-timer', babyId: 'b1', babyName: 'Léo', startedAt: '2026-03-05T20:00:00.000Z' },
        ttlSeconds: TICK_TTL_SECONDS,
      },
      {
        household,
        data: { type: 'sleep-timer', babyId: 'b2', babyName: 'Maëlys', startedAt: '2026-03-05T19:00:00.000Z' },
        ttlSeconds: TICK_TTL_SECONDS,
      },
    ])
  })

  it('still refreshes the other babies when one of them fails', async () => {
    const db = new FakeFirestore({
      [household]: {},
      [`${household}/babies/b1`]: { name: 'Léo' },
      [`${sleeps}/s1`]: { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: null },
      [`${household}/babies/b2`]: { name: 'Maëlys' },
      [`${household}/babies/b2/sleepEntries/s2`]: { startedAt: ts('2026-03-05T19:00:00Z'), endedAt: null },
    })
    const { sent } = recordingSender()
    const send = vi.fn(async (ref, data: Record<string, string>, ttlSeconds: number) => {
      if (data.babyId === 'b1') throw new Error('FCM down')
      sent.push({ household: ref.path, data, ttlSeconds })
    })

    await runSleepTick(db.asFirestore(), send)

    expect(send).toHaveBeenCalledTimes(2)
    expect(sent.map(({ data }) => data.babyId)).toEqual(['b2'])
  })
})

describe('handleSleepEntryWrite', () => {
  function write(docs: Record<string, Record<string, unknown>>, entryId: string, before?: Record<string, unknown>) {
    const db = new FakeFirestore({ [household]: {}, [`${household}/babies/b1`]: { name: 'Léo' }, ...docs })
    const ref = new FakeDocRef(db, `${sleeps}/${entryId}`)
    const asSnapshot = (snap: FakeDocSnapshot) => snap as unknown as Parameters<typeof handleSleepEntryWrite>[0]
    return {
      before: asSnapshot(new FakeDocSnapshot(ref, before)),
      after: asSnapshot(new FakeDocSnapshot(ref, db.docs.get(`${sleeps}/${entryId}`))),
    }
  }

  it('shows the timer as soon as a sleep starts', async () => {
    const { before, after } = write({ [`${sleeps}/s1`]: { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: null } }, 's1')
    const { sent, send } = recordingSender()

    await handleSleepEntryWrite(before, after, send)

    expect(sent).toEqual([
      {
        household,
        data: { type: 'sleep-timer', babyId: 'b1', babyName: 'Léo', startedAt: '2026-03-05T20:00:00.000Z' },
        ttlSeconds: TICK_TTL_SECONDS,
      },
    ])
  })

  it('clears the baby\'s timer with a push that outlives an offline phone', async () => {
    const { before, after } = write(
      { [`${sleeps}/s1`]: { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: ts('2026-03-05T21:00:00Z') } },
      's1',
      { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: null },
    )
    const { sent, send } = recordingSender()

    await handleSleepEntryWrite(before, after, send)

    expect(sent).toEqual([
      { household, data: { type: 'sleep-timer-stop', babyId: 'b1' }, ttlSeconds: STOP_TTL_SECONDS },
    ])
    expect(STOP_TTL_SECONDS).toBe(24 * 60 * 60)
  })

  it('keeps the timer while another sleep of the baby still runs', async () => {
    const { before, after } = write(
      {
        [`${sleeps}/s1`]: { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: ts('2026-03-05T21:00:00Z') },
        [`${sleeps}/s2`]: { startedAt: ts('2026-03-05T20:01:00Z'), endedAt: null },
      },
      's1',
      { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: null },
    )
    const { sent, send } = recordingSender()

    await handleSleepEntryWrite(before, after, send)

    expect(sent.map(({ data }) => data)).toEqual([
      { type: 'sleep-timer', babyId: 'b1', babyName: 'Léo', startedAt: '2026-03-05T20:01:00.000Z' },
    ])
  })

  it('ignores writes that do not change the timer', async () => {
    const entry = { startedAt: ts('2026-03-05T20:00:00Z'), endedAt: null, notes: 'edited' }
    const { before, after } = write({ [`${sleeps}/s1`]: entry }, 's1', { ...entry, notes: '' })
    const { sent, send } = recordingSender()

    await handleSleepEntryWrite(before, after, send)

    expect(sent).toEqual([])
  })
})
