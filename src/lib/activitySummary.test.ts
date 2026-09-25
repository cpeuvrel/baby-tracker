import { describe, expect, it } from 'vitest'
import { buildActivitySummary } from './activitySummary'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'

const range = { start: new Date('2026-03-04T17:00:00.000Z'), end: new Date('2026-03-05T17:00:00.000Z') }
const now = range.end

function feeding(occurredAt: string, overrides: Partial<FeedingEntry> = {}): FeedingEntry {
  return {
    id: occurredAt,
    type: 'bottle',
    occurredAt,
    volumeMl: 150,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: occurredAt,
    ...overrides,
  }
}

function sleep(startedAt: string, endedAt: string | null): SleepEntry {
  return { id: startedAt, startedAt, endedAt, durationSeconds: null, notes: '', createdBy: 'uid1', createdAt: startedAt }
}

function diaper(occurredAt: string, type: DiaperEntry['type']): DiaperEntry {
  return { id: occurredAt, type, occurredAt, notes: '', createdBy: 'uid1', createdAt: occurredAt }
}

function dose(givenAt: string): MedicationEntry {
  return { id: givenAt, name: 'Vitamin D', givenAt, dose: '', notes: '', createdBy: 'uid1', createdAt: givenAt }
}

const empty = { feeding: [], sleep: [], diaper: [], medication: [], bath: [] }

describe('buildActivitySummary', () => {
  it('is empty when nothing happened in the range', () => {
    expect(buildActivitySummary(empty, range, now)).toEqual([])
  })

  it('counts bottles in the range and sums their volume', () => {
    const rows = buildActivitySummary(
      {
        ...empty,
        feeding: [
          feeding('2026-03-05T08:00:00.000Z', { volumeMl: 180 }),
          feeding('2026-03-05T12:00:00.000Z', { volumeMl: 140 }),
          feeding('2026-03-04T10:00:00.000Z', { volumeMl: 999 }),
        ],
      },
      range,
      now,
    )

    expect(rows).toEqual([{ id: 'bottle', title: 'Bottle Feed', count: 2, lines: ['320 mL total'] }])
  })

  it('lists solids by food, once each', () => {
    const rows = buildActivitySummary(
      {
        ...empty,
        feeding: [
          feeding('2026-03-05T08:00:00.000Z', { type: 'solid', volumeMl: null, foodType: 'Carrot' }),
          feeding('2026-03-05T12:00:00.000Z', { type: 'solid', volumeMl: null, foodType: 'Carrot' }),
        ],
      },
      range,
      now,
    )

    expect(rows).toEqual([{ id: 'solid', title: 'Solids', count: 2, lines: ['Carrot'] }])
  })

  it('counts only the part of a sleep inside the range, and a running one up to now', () => {
    const rows = buildActivitySummary(
      {
        ...empty,
        sleep: [
          sleep('2026-03-04T16:00:00.000Z', '2026-03-04T18:00:00.000Z'),
          sleep('2026-03-05T16:30:00.000Z', null),
          sleep('2026-03-04T10:00:00.000Z', '2026-03-04T11:00:00.000Z'),
        ],
      },
      range,
      now,
    )

    expect(rows).toEqual([{ id: 'sleep', title: 'Sleep', count: 2, lines: ['1h 30m total sleep'] }])
  })

  it('breaks diapers down by type, counts baths and lists medication names', () => {
    const rows = buildActivitySummary(
      {
        ...empty,
        diaper: [
          diaper('2026-03-05T08:00:00.000Z', 'wet'),
          diaper('2026-03-05T09:00:00.000Z', 'both'),
          diaper('2026-03-05T10:00:00.000Z', 'wet'),
        ],
        medication: [dose('2026-03-05T08:00:00.000Z')],
        bath: [
          { id: 'b1', occurredAt: '2026-03-05T16:00:00.000Z', notes: '', createdBy: 'u', createdAt: '2026-03-05T16:00:00.000Z' },
        ],
      },
      range,
      now,
    )

    expect(rows).toEqual([
      { id: 'diaper', title: 'Diaper', count: 3, lines: ['2 wet, 1 wet + dirty'] },
      { id: 'bath', title: 'Bath', count: 1, lines: [] },
      { id: 'medication', title: 'Medication', count: 1, lines: ['Vitamin D'] },
    ])
  })
})
