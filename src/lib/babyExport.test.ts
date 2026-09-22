import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Baby, DiaperEntry, FeedingEntry, GrowthEntry, MedicationEntry, SleepEntry } from '../types/models'
import {
  EXPORT_FORMAT_VERSION,
  exportBabyData,
  importBabyData,
  parseBabyExport,
  serializeBabyExport,
  type BabyExport,
} from './babyExport'

const getAllFeedingEntries = vi.fn()
const importFeedingEntries = vi.fn()
const getAllSleepEntries = vi.fn()
const importSleepEntries = vi.fn()
const getAllDiaperEntries = vi.fn()
const importDiaperEntries = vi.fn()
const getAllGrowthEntries = vi.fn()
const importGrowthEntries = vi.fn()
const getAllMedicationEntries = vi.fn()
const importMedicationEntries = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  getAllFeedingEntries: (...args: unknown[]) => getAllFeedingEntries(...args),
  importFeedingEntries: (...args: unknown[]) => importFeedingEntries(...args),
}))
vi.mock('../repositories/sleepEntries', () => ({
  getAllSleepEntries: (...args: unknown[]) => getAllSleepEntries(...args),
  importSleepEntries: (...args: unknown[]) => importSleepEntries(...args),
}))
vi.mock('../repositories/diaperEntries', () => ({
  getAllDiaperEntries: (...args: unknown[]) => getAllDiaperEntries(...args),
  importDiaperEntries: (...args: unknown[]) => importDiaperEntries(...args),
}))
vi.mock('../repositories/growthEntries', () => ({
  getAllGrowthEntries: (...args: unknown[]) => getAllGrowthEntries(...args),
  importGrowthEntries: (...args: unknown[]) => importGrowthEntries(...args),
}))
vi.mock('../repositories/medicationEntries', () => ({
  getAllMedicationEntries: (...args: unknown[]) => getAllMedicationEntries(...args),
  importMedicationEntries: (...args: unknown[]) => importMedicationEntries(...args),
}))

const baby: Baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

const feeding: FeedingEntry[] = [
  {
    id: 'f1',
    type: 'bottle',
    occurredAt: '2026-01-01T08:00:00.000Z',
    volumeMl: 100,
    foodType: null,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
]
const sleep: SleepEntry[] = []
const diaper: DiaperEntry[] = []
const growth: GrowthEntry[] = []
const medication: MedicationEntry[] = []

describe('exportBabyData', () => {
  beforeEach(() => {
    getAllFeedingEntries.mockReset().mockResolvedValue(feeding)
    getAllSleepEntries.mockReset().mockResolvedValue(sleep)
    getAllDiaperEntries.mockReset().mockResolvedValue(diaper)
    getAllGrowthEntries.mockReset().mockResolvedValue(growth)
    getAllMedicationEntries.mockReset().mockResolvedValue(medication)
  })

  it('assembles every collection alongside the baby profile and a format version', async () => {
    const result = await exportBabyData('h1', baby)

    expect(result.formatVersion).toBe(EXPORT_FORMAT_VERSION)
    expect(result.baby).toEqual({ name: 'Léo', birthDate: '2025-06-01' })
    expect(result.feedingEntries).toEqual(feeding)
    expect(getAllFeedingEntries).toHaveBeenCalledWith('h1', 'b1')
  })
})

describe('serializeBabyExport / parseBabyExport', () => {
  const sample: BabyExport = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: '2026-03-05T10:00:00.000Z',
    baby: { name: 'Léo', birthDate: '2025-06-01' },
    feedingEntries: feeding,
    sleepEntries: sleep,
    diaperEntries: diaper,
    growthEntries: growth,
    medicationEntries: medication,
  }

  it('round-trips through JSON', () => {
    expect(parseBabyExport(serializeBabyExport(sample))).toEqual(sample)
  })

  it('rejects unreadable JSON', () => {
    expect(() => parseBabyExport('not json')).toThrow('JSON illisible')
  })

  it('rejects a missing or mismatched format version', () => {
    expect(() => parseBabyExport(JSON.stringify({ ...sample, formatVersion: 99 }))).toThrow(
      "Format d'export non reconnu",
    )
    expect(() => parseBabyExport(JSON.stringify({}))).toThrow("Format d'export non reconnu")
  })
})

describe('importBabyData', () => {
  beforeEach(() => {
    importFeedingEntries.mockReset().mockResolvedValue(undefined)
    importSleepEntries.mockReset().mockResolvedValue(undefined)
    importDiaperEntries.mockReset().mockResolvedValue(undefined)
    importGrowthEntries.mockReset().mockResolvedValue(undefined)
    importMedicationEntries.mockReset().mockResolvedValue(undefined)
  })

  it('imports every collection into the target baby', async () => {
    const data: BabyExport = {
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-03-05T10:00:00.000Z',
      baby: { name: 'Léo', birthDate: '2025-06-01' },
      feedingEntries: feeding,
      sleepEntries: sleep,
      diaperEntries: diaper,
      growthEntries: growth,
      medicationEntries: medication,
    }

    await importBabyData('h1', 'b2', data)

    expect(importFeedingEntries).toHaveBeenCalledWith('h1', 'b2', feeding)
    expect(importSleepEntries).toHaveBeenCalledWith('h1', 'b2', sleep)
    expect(importDiaperEntries).toHaveBeenCalledWith('h1', 'b2', diaper)
    expect(importGrowthEntries).toHaveBeenCalledWith('h1', 'b2', growth)
    expect(importMedicationEntries).toHaveBeenCalledWith('h1', 'b2', medication)
  })
})
