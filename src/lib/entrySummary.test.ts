import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, GrowthEntry, MedicationEntry, SleepEntry } from '../types/models'
import {
  latestGrowthEntryWithField,
  summarizeDiaperPrimary,
  summarizeDiaperRow,
  summarizeFeedingPrimary,
  summarizeFeedingRow,
  summarizeMedicationPrimary,
  summarizeMedicationRow,
  summarizeSleepPrimary,
  summarizeSleepRow,
} from './entrySummary'

const now = new Date('2026-03-05T12:00:00.000Z')

describe('summarizeFeedingPrimary', () => {
  it('labels a bottle entry generically, leaving the volume to the highlight value', () => {
    const entry: FeedingEntry = {
      id: 'f1',
      type: 'bottle',
      occurredAt: '2026-03-05T11:30:00.000Z',
      volumeMl: 120,
      foodType: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeFeedingPrimary(entry, now)).toEqual({
      label: 'Last feeding',
      meta: '30m ago',
    })
  })

  it('labels a solid entry with its food type', () => {
    const entry: FeedingEntry = {
      id: 'f2',
      type: 'solid',
      occurredAt: '2026-03-05T11:30:00.000Z',
      volumeMl: null,
      foodType: 'carrot purée',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeFeedingPrimary(entry, now)).toEqual({
      label: 'carrot purée',
      meta: '30m ago',
    })
  })
})

describe('summarizeSleepPrimary', () => {
  it('labels a finished entry as "Woke up"', () => {
    const entry: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: '2026-03-05T11:00:00.000Z',
      durationSeconds: 3600,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }

    expect(summarizeSleepPrimary(entry, now)).toEqual({ label: 'Woke up', meta: '2h 00m ago' })
  })

  it('labels an active entry as "Sleeping"', () => {
    const entry: SleepEntry = {
      id: 's2',
      startedAt: '2026-03-05T11:30:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeSleepPrimary(entry, now)).toEqual({ label: 'Sleeping', meta: 'since 30m ago' })
  })
})

describe('summarizeDiaperPrimary', () => {
  it('splits the diaper type and relative time', () => {
    const entry: DiaperEntry = {
      id: 'd1',
      type: 'both',
      occurredAt: '2026-03-05T11:30:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeDiaperPrimary(entry, now)).toEqual({ label: 'Wet + Dirty', meta: '30m ago' })
  })
})

describe('summarizeMedicationPrimary', () => {
  it('includes the dose in the meta when present', () => {
    const entry: MedicationEntry = {
      id: 'm1',
      name: 'Vitamin D',
      givenAt: '2026-03-05T11:30:00.000Z',
      dose: '2 drops',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeMedicationPrimary(entry, now)).toEqual({
      label: 'Vitamin D',
      meta: '2 drops — 30m ago',
    })
  })

  it('omits the dose from the meta when absent', () => {
    const entry: MedicationEntry = {
      id: 'm2',
      name: 'Vitamin D',
      givenAt: '2026-03-05T11:30:00.000Z',
      dose: '',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeMedicationPrimary(entry, now)).toEqual({
      label: 'Vitamin D',
      meta: '30m ago',
    })
  })
})

function feedingEntry(overrides: Partial<FeedingEntry>): FeedingEntry {
  return {
    id: 'f1',
    type: 'bottle',
    occurredAt: '2026-03-05T08:33:00.000Z',
    volumeMl: 40,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T08:33:00.000Z',
    ...overrides,
  }
}

describe('summarizeFeedingRow', () => {
  it('shows the time, a bottle bar and value proportional to the given max', () => {
    expect(summarizeFeedingRow(feedingEntry({ volumeMl: 40 }), 150)).toEqual({
      title: expect.stringContaining('Bottle'),
      value: '40 mL',
      barFraction: 40 / 150,
    })
  })

  it('omits the bar when the bottle has no recorded volume', () => {
    const row = summarizeFeedingRow(feedingEntry({ volumeMl: null }), 150)

    expect(row.value).toBeUndefined()
    expect(row.barFraction).toBeUndefined()
  })

  it('shows the food type for a solid entry, without a bar', () => {
    const row = summarizeFeedingRow(
      feedingEntry({ type: 'solid', volumeMl: null, foodType: 'Fig' }),
      150,
    )

    expect(row.title).toContain('Fig')
    expect(row.value).toBeUndefined()
  })
})

function sleepEntry(overrides: Partial<SleepEntry>): SleepEntry {
  return {
    id: 's1',
    startedAt: '2026-03-05T06:00:00.000Z',
    endedAt: '2026-03-05T08:15:00.000Z',
    durationSeconds: 8100,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T06:00:00.000Z',
    ...overrides,
  }
}

describe('summarizeSleepRow', () => {
  it('shows a start–end range, duration and a bar proportional to the given max', () => {
    const row = summarizeSleepRow(sleepEntry({ durationSeconds: 8100 }), now, 8100)

    expect(row.title).toMatch(/–/)
    expect(row.value).toBe(formatDurationForTest(8100))
    expect(row.barFraction).toBe(1)
  })

  it('shows a "Timer running" label without a bar for an active entry', () => {
    const row = summarizeSleepRow(
      sleepEntry({ endedAt: null, durationSeconds: null }),
      now,
      8100,
    )

    expect(row.title).toContain('Timer running')
    expect(row.value).toBeUndefined()
    expect(row.barFraction).toBeUndefined()
  })

  it('prefixes with "Yesterday" for an entry started the day before', () => {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(20, 0, 0, 0)
    const endedAt = new Date(yesterday.getTime() + 3600_000)

    const row = summarizeSleepRow(
      sleepEntry({ startedAt: yesterday.toISOString(), endedAt: endedAt.toISOString(), durationSeconds: 3600 }),
      now,
      3600,
    )

    expect(row.title.startsWith('Yesterday ')).toBe(true)
  })
})

function formatDurationForTest(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

describe('summarizeDiaperRow', () => {
  it('shows the time and diaper type', () => {
    const entry: DiaperEntry = {
      id: 'd1',
      type: 'wet',
      occurredAt: '2026-03-05T08:00:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T08:00:00.000Z',
    }

    expect(summarizeDiaperRow(entry).title).toContain('Wet')
  })
})

describe('summarizeMedicationRow', () => {
  it('shows the dose as the value when present', () => {
    const entry: MedicationEntry = {
      id: 'm1',
      name: 'Vitamin D',
      givenAt: '2026-03-05T08:00:00.000Z',
      dose: '2 drops',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T08:00:00.000Z',
    }

    expect(summarizeMedicationRow(entry)).toEqual({
      title: expect.stringContaining('Vitamin D'),
      value: '2 drops',
    })
  })

  it('omits the value when there is no dose', () => {
    const entry: MedicationEntry = {
      id: 'm2',
      name: 'Vitamin D',
      givenAt: '2026-03-05T08:00:00.000Z',
      dose: '',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T08:00:00.000Z',
    }

    expect(summarizeMedicationRow(entry).value).toBeUndefined()
  })
})

describe('latestGrowthEntryWithField', () => {
  const older: GrowthEntry = {
    id: 'g1',
    measuredAt: '2026-01-01T00:00:00.000Z',
    weightG: 5000,
    heightMm: null,
    headCircumferenceMm: 380,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  const newer: GrowthEntry = {
    id: 'g2',
    measuredAt: '2026-03-01T00:00:00.000Z',
    weightG: 6200,
    heightMm: 620,
    headCircumferenceMm: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-01T00:00:00.000Z',
  }

  it('returns the most recent entry that has the given field set', () => {
    expect(latestGrowthEntryWithField([older, newer], 'weightG')).toBe(newer)
    expect(latestGrowthEntryWithField([older, newer], 'headCircumferenceMm')).toBe(older)
  })

  it('returns undefined when no entry has the field set', () => {
    expect(latestGrowthEntryWithField([older, newer], 'heightMm')).toBe(newer)
    expect(latestGrowthEntryWithField([], 'weightG')).toBeUndefined()
  })
})
