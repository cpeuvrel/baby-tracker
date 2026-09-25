import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Baby,
  BathEntry,
  DiaperEntry,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'
import {
  exportBabyData,
  importBabyData,
  parseImportFile,
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
const getAllBathEntries = vi.fn()
const importMedicationEntries = vi.fn()
const importBathEntries = vi.fn()

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
vi.mock('../repositories/bathEntries', () => ({
  getAllBathEntries: (...args: unknown[]) => getAllBathEntries(...args),
  importBathEntries: (...args: unknown[]) => importBathEntries(...args),
}))
vi.mock('../repositories/medicationEntries', () => ({
  getAllMedicationEntries: (...args: unknown[]) => getAllMedicationEntries(...args),
  importMedicationEntries: (...args: unknown[]) => importMedicationEntries(...args),
}))

const baby: Baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

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
const sleep: SleepEntry[] = [
  {
    id: 's1',
    startedAt: '2026-01-01T20:00:00.000Z',
    endedAt: '2026-01-01T22:00:00.000Z',
    durationSeconds: 7200,
    notes: 'sieste',
    createdBy: 'uid1',
    createdAt: '2026-01-01T20:00:00.000Z',
  },
]
const diaper: DiaperEntry[] = [
  {
    id: 'd1',
    type: 'wet',
    occurredAt: '2026-01-01T09:00:00.000Z',
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-01-01T09:00:00.000Z',
  },
]
const growth: GrowthEntry[] = [
  {
    id: 'g1',
    measuredAt: '2026-01-01T00:00:00.000Z',
    weightG: 4200,
    heightMm: 550,
    headCircumferenceMm: 380,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]
const medication: MedicationEntry[] = [
  {
    id: 'm1',
    name: 'Vitamin D',
    givenAt: '2026-01-01T10:00:00.000Z',
    dose: '2 drops',
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-01-01T10:00:00.000Z',
  },
]

const bath: BathEntry[] = [
  {
    id: 'bath1',
    occurredAt: '2026-01-01T18:30:00.000Z',
    notes: 'warm',
    createdBy: 'uid1',
    createdAt: '2026-01-01T18:30:00.000Z',
  },
]

describe('exportBabyData', () => {
  beforeEach(() => {
    getAllFeedingEntries.mockReset().mockResolvedValue(feeding)
    getAllSleepEntries.mockReset().mockResolvedValue(sleep)
    getAllDiaperEntries.mockReset().mockResolvedValue(diaper)
    getAllGrowthEntries.mockReset().mockResolvedValue(growth)
    getAllMedicationEntries.mockReset().mockResolvedValue(medication)
    getAllBathEntries.mockReset().mockResolvedValue(bath)
  })

  it('assembles every collection for the given baby', async () => {
    const result = await exportBabyData('h1', baby)

    expect(result.feedingEntries).toEqual(feeding)
    expect(result.sleepEntries).toEqual(sleep)
    expect(result.bathEntries).toEqual(bath)
    expect(getAllFeedingEntries).toHaveBeenCalledWith('h1', 'b1')
  })
})

describe('serializeBabyExport / parseImportFile (native format)', () => {
  const sample: BabyExport = {
    feedingEntries: feeding,
    sleepEntries: sleep,
    diaperEntries: diaper,
    growthEntries: growth,
    medicationEntries: medication,
    bathEntries: bath,
  }

  it('round-trips every entry type through CSV', () => {
    const csv = serializeBabyExport(sample)
    const { data, skipped } = parseImportFile(csv, 'uid1')

    expect(skipped).toBe(0)
    expect(data.feedingEntries).toEqual([{ ...feeding[0], id: expect.any(String) }])
    expect(data.sleepEntries).toEqual([{ ...sleep[0], id: expect.any(String) }])
    expect(data.diaperEntries).toEqual([{ ...diaper[0], id: expect.any(String) }])
    expect(data.growthEntries).toEqual([{ ...growth[0], id: expect.any(String) }])
    expect(data.medicationEntries).toEqual([{ ...medication[0], id: expect.any(String) }])
    expect(data.bathEntries).toEqual([{ ...bath[0], id: expect.any(String) }])
  })

  it('preserves commas and quotes in notes', () => {
    const withComma: BabyExport = {
      ...sample,
      sleepEntries: [{ ...sleep[0], notes: 'sieste, courte "mais bonne"' }],
    }

    const { data } = parseImportFile(serializeBabyExport(withComma), 'uid1')

    expect(data.sleepEntries[0].notes).toBe('sieste, courte "mais bonne"')
  })

  it('rejects an empty file', () => {
    expect(() => parseImportFile('', 'uid1')).toThrow('Empty file')
  })

  it('rejects an unrecognized CSV header', () => {
    expect(() => parseImportFile('foo,bar\n1,2', 'uid1')).toThrow('Unrecognized CSV file format')
  })
})

describe('parseImportFile (Nara export format)', () => {
  const NARA_HEADER =
    '"Type","Profile Name","Start Date/time","Start Date/time (Epoch)","Created By Caregiver","Last Updated By Caregiver","Note","Time Zone","[Bottle Feed] Type","[Bottle Feed] Breast Milk Volume","[Bottle Feed] Breast Milk Volume Unit","[Bottle Feed] Formula Name","[Bottle Feed] Formula Volume","[Bottle Feed] Formula Volume Unit","[Bottle Feed] Volume","[Bottle Feed] Volume Unit","[Sleep] Duration (Seconds)","[Sleep] End Date/time","[Sleep] End Date/time (Epoch)","[Growth] Head Size","[Growth] Head Size Unit","[Growth] Height","[Growth] Height Unit","[Growth] Weight","[Growth] Weight Unit","[Solid Feed] Food","[Solid Feed] Meal","[Routine] Routine","[Diaper] Type","[Diaper] Detail","[Diaper] Dirty Color","[Diaper] Dirty Texture","[Profile] Birth Date","[Profile] Birth Date (Adjusted)","[Profile] Sex","[Profile] Type","_familyKey","_profileKey","_activityKey"'

  function naraRow(fields: Record<string, string>): string {
    const columns = NARA_HEADER.split(',').map((c) => c.replace(/"/g, ''))
    return columns.map((name) => `"${fields[name] ?? ''}"`).join(',')
  }

  it('imports a bottle feed row with a formula volume', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Bottle Feed',
      'Start Date/time (Epoch)': '1790058780000',
      '[Bottle Feed] Type': 'Formula',
      '[Bottle Feed] Formula Volume': '150',
      '[Bottle Feed] Formula Volume Unit': 'ML',
    })}`

    const { data, skipped } = parseImportFile(csv, 'uid1')

    expect(skipped).toBe(0)
    expect(data.feedingEntries).toEqual([
      expect.objectContaining({
        type: 'bottle',
        volumeMl: 150,
        occurredAt: new Date(1790058780000).toISOString(),
        createdBy: 'uid1',
      }),
    ])
  })

  it('sums breast milk and formula volume for a combo feed', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Bottle Feed',
      'Start Date/time (Epoch)': '1790058780000',
      '[Bottle Feed] Breast Milk Volume': '60',
      '[Bottle Feed] Breast Milk Volume Unit': 'ML',
      '[Bottle Feed] Formula Volume': '40',
      '[Bottle Feed] Formula Volume Unit': 'ML',
    })}`

    const { data } = parseImportFile(csv, 'uid1')

    expect(data.feedingEntries[0].volumeMl).toBe(100)
  })

  it('converts ounces to millilitres', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Bottle Feed',
      'Start Date/time (Epoch)': '1790058780000',
      '[Bottle Feed] Formula Volume': '4',
      '[Bottle Feed] Formula Volume Unit': 'OZ',
    })}`

    const { data } = parseImportFile(csv, 'uid1')

    expect(data.feedingEntries[0].volumeMl).toBe(Math.round(4 * 29.5735))
  })

  it('imports a solid feed row, falling back to the meal label when there is no note', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Solid Feed',
      'Start Date/time (Epoch)': '1790058780000',
      '[Solid Feed] Food': 'Figue',
      '[Solid Feed] Meal': 'LUNCH',
    })}`

    const { data } = parseImportFile(csv, 'uid1')

    expect(data.feedingEntries).toEqual([
      expect.objectContaining({ type: 'solid', foodType: 'Figue', notes: 'Lunch' }),
    ])
  })

  it('imports a sleep row using the epoch timestamps and duration', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Sleep',
      'Start Date/time (Epoch)': '1790049624000',
      '[Sleep] Duration (Seconds)': '8076',
      '[Sleep] End Date/time (Epoch)': '1790057700000',
    })}`

    const { data } = parseImportFile(csv, 'uid1')

    expect(data.sleepEntries).toEqual([
      expect.objectContaining({
        startedAt: new Date(1790049624000).toISOString(),
        endedAt: new Date(1790057700000).toISOString(),
        durationSeconds: 8076,
      }),
    ])
  })

  it.each([
    ['Dirty Wet', 'both'],
    ['Dirty', 'dirty'],
    ['Wet', 'wet'],
    ['Dry', 'dry'],
  ])('maps diaper type %s to %s', (naraType, ourType) => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Diaper',
      'Start Date/time (Epoch)': '1790058780000',
      '[Diaper] Type': naraType,
    })}`

    const { data, skipped } = parseImportFile(csv, 'uid1')

    expect(skipped).toBe(0)
    expect(data.diaperEntries[0].type).toBe(ourType)
  })

  it('folds diaper detail/color/texture into notes', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Diaper',
      'Start Date/time (Epoch)': '1790058780000',
      '[Diaper] Type': 'Dirty',
      '[Diaper] Detail': 'Blowout',
      '[Diaper] Dirty Color': 'GREEN',
    })}`

    const { data } = parseImportFile(csv, 'uid1')

    expect(data.diaperEntries[0].notes).toBe('Blowout · GREEN')
  })

  it('converts growth measurements from KG/CM to grams/millimetres', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Growth',
      'Start Date/time (Epoch)': '1790058780000',
      '[Growth] Weight': '4.2',
      '[Growth] Weight Unit': 'KG',
      '[Growth] Height': '55',
      '[Growth] Height Unit': 'CM',
      '[Growth] Head Size': '38',
      '[Growth] Head Size Unit': 'CM',
    })}`

    const { data } = parseImportFile(csv, 'uid1')

    expect(data.growthEntries).toEqual([
      expect.objectContaining({ weightG: 4200, heightMm: 550, headCircumferenceMm: 380 }),
    ])
  })

  it('imports a Vitamin/Probiotic routine as a medication entry', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Routine',
      'Start Date/time (Epoch)': '1790058780000',
      '[Routine] Routine': 'Vitamin/Probiotic',
    })}`

    const { data, skipped } = parseImportFile(csv, 'uid1')

    expect(skipped).toBe(0)
    expect(data.medicationEntries).toEqual([
      expect.objectContaining({ name: 'Vitamin/Probiotic', dose: '' }),
    ])
  })

  it('imports a Bath routine as a bath entry', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Routine',
      'Start Date/time (Epoch)': '1790058780000',
      '[Routine] Routine': 'Bath',
    })}`

    const { data, skipped } = parseImportFile(csv, 'uid1')

    expect(skipped).toBe(0)
    expect(data.bathEntries).toEqual([
      expect.objectContaining({ occurredAt: new Date(1790058780000).toISOString(), createdBy: 'uid1' }),
    ])
  })

  it('skips unsupported rows (other routines, Profile) and reports the count', () => {
    const csv = `${NARA_HEADER}\n${naraRow({
      Type: 'Routine',
      'Start Date/time (Epoch)': '1790058780000',
      '[Routine] Routine': 'Brush Teeth',
    })}\n${naraRow({ Type: 'Profile' })}`

    const { data, skipped } = parseImportFile(csv, 'uid1')

    expect(skipped).toBe(2)
    expect(data.feedingEntries).toEqual([])
    expect(data.medicationEntries).toEqual([])
  })
})

describe('importBabyData', () => {
  beforeEach(() => {
    importFeedingEntries.mockReset().mockResolvedValue(undefined)
    importSleepEntries.mockReset().mockResolvedValue(undefined)
    importDiaperEntries.mockReset().mockResolvedValue(undefined)
    importGrowthEntries.mockReset().mockResolvedValue(undefined)
    importMedicationEntries.mockReset().mockResolvedValue(undefined)
    importBathEntries.mockReset().mockResolvedValue(undefined)
  })

  it('imports every collection into the target baby', async () => {
    const data: BabyExport = {
      feedingEntries: feeding,
      sleepEntries: sleep,
      diaperEntries: diaper,
      growthEntries: growth,
      medicationEntries: medication,
      bathEntries: bath,
    }

    await importBabyData('h1', 'b2', data)

    expect(importFeedingEntries).toHaveBeenCalledWith('h1', 'b2', feeding)
    expect(importSleepEntries).toHaveBeenCalledWith('h1', 'b2', sleep)
    expect(importDiaperEntries).toHaveBeenCalledWith('h1', 'b2', diaper)
    expect(importGrowthEntries).toHaveBeenCalledWith('h1', 'b2', growth)
    expect(importMedicationEntries).toHaveBeenCalledWith('h1', 'b2', medication)
    expect(importBathEntries).toHaveBeenCalledWith('h1', 'b2', bath)
  })
})
