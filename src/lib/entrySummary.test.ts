import { describe, expect, it } from 'vitest'
import type { DiaperEntry, FeedingEntry, GrowthEntry, MedicationEntry, SleepEntry } from '../types/models'
import {
  summarizeDiaperEntry,
  summarizeDiaperPrimary,
  summarizeFeedingEntry,
  summarizeFeedingPrimary,
  summarizeGrowthEntry,
  summarizeGrowthPrimary,
  summarizeMedicationEntry,
  summarizeMedicationPrimary,
  summarizeSleepEntry,
  summarizeSleepPrimary,
} from './entrySummary'

const now = new Date('2026-03-05T12:00:00.000Z')

describe('summarizeFeedingEntry', () => {
  it('shows the volume for a bottle entry', () => {
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

    expect(summarizeFeedingEntry(entry, now)).toBe('120 mL — il y a 30min')
  })

  it('shows the food type for a solid entry', () => {
    const entry: FeedingEntry = {
      id: 'f2',
      type: 'solid',
      occurredAt: '2026-03-05T11:30:00.000Z',
      volumeMl: null,
      foodType: 'purée carotte',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeFeedingEntry(entry, now)).toBe('purée carotte — il y a 30min')
  })
})

describe('summarizeSleepEntry', () => {
  it('shows the duration for a finished entry', () => {
    const entry: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: '2026-03-05T11:00:00.000Z',
      durationSeconds: 3600,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }

    expect(summarizeSleepEntry(entry, now)).toBe('1h 00min — il y a 2h 00min')
  })

  it('shows an in-progress label for an active entry', () => {
    const entry: SleepEntry = {
      id: 's2',
      startedAt: '2026-03-05T11:30:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeSleepEntry(entry, now)).toBe('En cours depuis il y a 30min')
  })
})

describe('summarizeDiaperEntry', () => {
  it('shows the diaper type and relative time', () => {
    const entry: DiaperEntry = {
      id: 'd1',
      type: 'both',
      occurredAt: '2026-03-05T11:30:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeDiaperEntry(entry, now)).toBe('Pipi + caca — il y a 30min')
  })
})

describe('summarizeMedicationEntry', () => {
  it('shows the dose when present', () => {
    const entry: MedicationEntry = {
      id: 'm1',
      name: 'Vitamine D',
      givenAt: '2026-03-05T11:30:00.000Z',
      dose: '2 gouttes',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeMedicationEntry(entry, now)).toBe('Vitamine D — 2 gouttes — il y a 30min')
  })

  it('omits the dose when absent', () => {
    const entry: MedicationEntry = {
      id: 'm2',
      name: 'Vitamine D',
      givenAt: '2026-03-05T11:30:00.000Z',
      dose: '',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeMedicationEntry(entry, now)).toBe('Vitamine D — il y a 30min')
  })
})

describe('summarizeGrowthEntry', () => {
  it('joins the available measurements', () => {
    const entry: GrowthEntry = {
      id: 'g1',
      measuredAt: '2026-03-05T11:30:00.000Z',
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeGrowthEntry(entry, now)).toBe('6.20 kg · 62.0 cm — il y a 30min')
  })

  it('falls back to a generic label when no measurement is present', () => {
    const entry: GrowthEntry = {
      id: 'g2',
      measuredAt: '2026-03-05T11:30:00.000Z',
      weightG: null,
      heightMm: null,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeGrowthEntry(entry, now)).toBe('Mesure — il y a 30min')
  })
})

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
      label: 'Dernier biberon',
      meta: 'il y a 30min',
    })
  })

  it('labels a solid entry with its food type', () => {
    const entry: FeedingEntry = {
      id: 'f2',
      type: 'solid',
      occurredAt: '2026-03-05T11:30:00.000Z',
      volumeMl: null,
      foodType: 'purée carotte',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeFeedingPrimary(entry, now)).toEqual({
      label: 'purée carotte',
      meta: 'il y a 30min',
    })
  })
})

describe('summarizeSleepPrimary', () => {
  it('labels a finished entry as "Réveillé"', () => {
    const entry: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-05T10:00:00.000Z',
      endedAt: '2026-03-05T11:00:00.000Z',
      durationSeconds: 3600,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T10:00:00.000Z',
    }

    expect(summarizeSleepPrimary(entry, now)).toEqual({ label: 'Réveillé', meta: 'il y a 2h 00min' })
  })

  it('labels an active entry as "En cours"', () => {
    const entry: SleepEntry = {
      id: 's2',
      startedAt: '2026-03-05T11:30:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeSleepPrimary(entry, now)).toEqual({ label: 'En cours', meta: 'depuis il y a 30min' })
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

    expect(summarizeDiaperPrimary(entry, now)).toEqual({ label: 'Pipi + caca', meta: 'il y a 30min' })
  })
})

describe('summarizeMedicationPrimary', () => {
  it('includes the dose in the meta when present', () => {
    const entry: MedicationEntry = {
      id: 'm1',
      name: 'Vitamine D',
      givenAt: '2026-03-05T11:30:00.000Z',
      dose: '2 gouttes',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeMedicationPrimary(entry, now)).toEqual({
      label: 'Vitamine D',
      meta: '2 gouttes — il y a 30min',
    })
  })

  it('omits the dose from the meta when absent', () => {
    const entry: MedicationEntry = {
      id: 'm2',
      name: 'Vitamine D',
      givenAt: '2026-03-05T11:30:00.000Z',
      dose: '',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeMedicationPrimary(entry, now)).toEqual({
      label: 'Vitamine D',
      meta: 'il y a 30min',
    })
  })
})

describe('summarizeGrowthPrimary', () => {
  it('joins the available measurements into the label', () => {
    const entry: GrowthEntry = {
      id: 'g1',
      measuredAt: '2026-03-05T11:30:00.000Z',
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeGrowthPrimary(entry, now)).toEqual({
      label: '6.20 kg · 62.0 cm',
      meta: 'il y a 30min',
    })
  })

  it('falls back to a generic label when no measurement is present', () => {
    const entry: GrowthEntry = {
      id: 'g2',
      measuredAt: '2026-03-05T11:30:00.000Z',
      weightG: null,
      heightMm: null,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T11:30:00.000Z',
    }

    expect(summarizeGrowthPrimary(entry, now)).toEqual({ label: 'Mesure', meta: 'il y a 30min' })
  })
})
