import { parseCsv, toCsv } from './csv'
import { getAllBathEntries, importBathEntries } from '../repositories/bathEntries'
import { getAllDiaperEntries, importDiaperEntries } from '../repositories/diaperEntries'
import { getAllFeedingEntries, importFeedingEntries } from '../repositories/feedingEntries'
import { getAllGrowthEntries, importGrowthEntries } from '../repositories/growthEntries'
import {
  getAllMedicationEntries,
  importMedicationEntries,
} from '../repositories/medicationEntries'
import { getAllSleepEntries, importSleepEntries } from '../repositories/sleepEntries'
import type {
  Baby,
  BathEntry,
  DiaperEntry,
  DiaperType,
  FeedingEntry,
  FeedingType,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

export interface BabyExport {
  feedingEntries: FeedingEntry[]
  sleepEntries: SleepEntry[]
  diaperEntries: DiaperEntry[]
  growthEntries: GrowthEntry[]
  medicationEntries: MedicationEntry[]
  bathEntries: BathEntry[]
}

export async function exportBabyData(householdId: string, baby: Baby): Promise<BabyExport> {
  const [feedingEntries, sleepEntries, diaperEntries, growthEntries, medicationEntries, bathEntries] =
    await Promise.all([
      getAllFeedingEntries(householdId, baby.id),
      getAllSleepEntries(householdId, baby.id),
      getAllDiaperEntries(householdId, baby.id),
      getAllGrowthEntries(householdId, baby.id),
      getAllMedicationEntries(householdId, baby.id),
      getAllBathEntries(householdId, baby.id),
    ])

  return { feedingEntries, sleepEntries, diaperEntries, growthEntries, medicationEntries, bathEntries }
}

// --- App's native format: a single CSV, one category per row ---

const NATIVE_HEADER = [
  'category',
  'at',
  'endAt',
  'durationSeconds',
  'subtype',
  'volumeMl',
  'foodType',
  'weightG',
  'heightMm',
  'headCircumferenceMm',
  'medicationName',
  'dose',
  'notes',
  'createdBy',
  'createdAt',
]

const CATEGORY = 0
const AT = 1
const END_AT = 2
const DURATION = 3
const SUBTYPE = 4
const VOLUME_ML = 5
const FOOD_TYPE = 6
const WEIGHT_G = 7
const HEIGHT_MM = 8
const HEAD_MM = 9
const MED_NAME = 10
const DOSE = 11
const NOTES = 12
const CREATED_BY = 13
const CREATED_AT = 14

function numOrEmpty(value: number | null): string {
  return value == null ? '' : String(value)
}

export function serializeBabyExport(data: BabyExport): string {
  const rows: string[][] = [NATIVE_HEADER]

  for (const entry of data.feedingEntries) {
    rows.push([
      'feeding', entry.occurredAt, '', '', entry.type,
      numOrEmpty(entry.volumeMl), entry.foodType ?? '', '', '', '',
      '', '', entry.notes, entry.createdBy, entry.createdAt,
    ])
  }
  for (const entry of data.sleepEntries) {
    rows.push([
      'sleep', entry.startedAt, entry.endedAt ?? '', numOrEmpty(entry.durationSeconds), '',
      '', '', '', '', '',
      '', '', entry.notes, entry.createdBy, entry.createdAt,
    ])
  }
  for (const entry of data.diaperEntries) {
    rows.push([
      'diaper', entry.occurredAt, '', '', entry.type,
      '', '', '', '', '',
      '', '', entry.notes, entry.createdBy, entry.createdAt,
    ])
  }
  for (const entry of data.growthEntries) {
    rows.push([
      'growth', entry.measuredAt, '', '', '',
      '', '', numOrEmpty(entry.weightG), numOrEmpty(entry.heightMm), numOrEmpty(entry.headCircumferenceMm),
      '', '', entry.notes, entry.createdBy, entry.createdAt,
    ])
  }
  for (const entry of data.medicationEntries) {
    rows.push([
      'medication', entry.givenAt, '', '', '',
      '', '', '', '', '',
      entry.name, entry.dose, entry.notes, entry.createdBy, entry.createdAt,
    ])
  }
  for (const entry of data.bathEntries) {
    rows.push([
      'bath', entry.occurredAt, '', '', '',
      '', '', '', '', '',
      '', '', entry.notes, entry.createdBy, entry.createdAt,
    ])
  }

  return toCsv(rows)
}

function num(value: string): number | null {
  return value === '' ? null : Number(value)
}

function parseNativeRows(dataRows: string[][]): BabyExport {
  const feedingEntries: FeedingEntry[] = []
  const sleepEntries: SleepEntry[] = []
  const diaperEntries: DiaperEntry[] = []
  const growthEntries: GrowthEntry[] = []
  const medicationEntries: MedicationEntry[] = []
  const bathEntries: BathEntry[] = []
  let nextId = 0

  for (const row of dataRows) {
    const id = `native-${nextId++}`
    switch (row[CATEGORY]) {
      case 'feeding':
        feedingEntries.push({
          id,
          type: row[SUBTYPE] as FeedingType,
          occurredAt: row[AT],
          volumeMl: num(row[VOLUME_ML]),
          foodType: row[FOOD_TYPE] || null,
          notes: row[NOTES],
          createdBy: row[CREATED_BY],
          createdAt: row[CREATED_AT],
        })
        break
      case 'sleep':
        sleepEntries.push({
          id,
          startedAt: row[AT],
          endedAt: row[END_AT] || null,
          durationSeconds: num(row[DURATION]),
          notes: row[NOTES],
          createdBy: row[CREATED_BY],
          createdAt: row[CREATED_AT],
        })
        break
      case 'diaper':
        diaperEntries.push({
          id,
          type: row[SUBTYPE] as DiaperType,
          occurredAt: row[AT],
          notes: row[NOTES],
          createdBy: row[CREATED_BY],
          createdAt: row[CREATED_AT],
        })
        break
      case 'growth':
        growthEntries.push({
          id,
          measuredAt: row[AT],
          weightG: num(row[WEIGHT_G]),
          heightMm: num(row[HEIGHT_MM]),
          headCircumferenceMm: num(row[HEAD_MM]),
          notes: row[NOTES],
          createdBy: row[CREATED_BY],
          createdAt: row[CREATED_AT],
        })
        break
      case 'medication':
        medicationEntries.push({
          id,
          name: row[MED_NAME],
          givenAt: row[AT],
          dose: row[DOSE],
          notes: row[NOTES],
          createdBy: row[CREATED_BY],
          createdAt: row[CREATED_AT],
        })
        break
      case 'bath':
        bathEntries.push({
          id,
          occurredAt: row[AT],
          notes: row[NOTES],
          createdBy: row[CREATED_BY],
          createdAt: row[CREATED_AT],
        })
        break
    }
  }

  return { feedingEntries, sleepEntries, diaperEntries, growthEntries, medicationEntries, bathEntries }
}

// --- Format Nara (export RGPD) ---

const NARA_DIAPER_TYPES: Record<string, DiaperType> = {
  'Dirty Wet': 'both',
  Dirty: 'dirty',
  Wet: 'wet',
  Dry: 'dry',
}

const NARA_MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
}

function epochToIso(value: string): string {
  return new Date(Number(value)).toISOString()
}

function naraVolumeToMl(value: string, unit: string): number | null {
  if (value === '') return null
  const amount = Number(value)
  return Math.round(unit === 'OZ' ? amount * 29.5735 : amount)
}

function naraWeightToGrams(value: string, unit: string): number | null {
  if (value === '') return null
  const amount = Number(value)
  if (unit === 'LB') return Math.round(amount * 453.592)
  if (unit === 'G') return Math.round(amount)
  return Math.round(amount * 1000)
}

function naraLengthToMm(value: string, unit: string): number | null {
  if (value === '') return null
  const amount = Number(value)
  if (unit === 'IN') return Math.round(amount * 25.4)
  if (unit === 'MM') return Math.round(amount)
  return Math.round(amount * 10)
}

function joinNotes(...parts: string[]): string {
  return parts.filter(Boolean).join(' · ')
}

function parseNaraRows(
  header: string[],
  dataRows: string[][],
  currentUserUid: string,
): { data: BabyExport; skipped: number } {
  const col = (name: string) => {
    const index = header.indexOf(name)
    if (index === -1) throw new Error(`Missing Nara column: ${name}`)
    return index
  }

  const TYPE = col('Type')
  const START_EPOCH = col('Start Date/time (Epoch)')
  const NOTE = col('Note')
  const BREAST_VOL = col('[Bottle Feed] Breast Milk Volume')
  const BREAST_UNIT = col('[Bottle Feed] Breast Milk Volume Unit')
  const FORMULA_VOL = col('[Bottle Feed] Formula Volume')
  const FORMULA_UNIT = col('[Bottle Feed] Formula Volume Unit')
  const GENERIC_VOL = col('[Bottle Feed] Volume')
  const GENERIC_VOL_UNIT = col('[Bottle Feed] Volume Unit')
  const SLEEP_DURATION = col('[Sleep] Duration (Seconds)')
  const SLEEP_END_EPOCH = col('[Sleep] End Date/time (Epoch)')
  const HEAD_SIZE = col('[Growth] Head Size')
  const HEAD_UNIT = col('[Growth] Head Size Unit')
  const HEIGHT = col('[Growth] Height')
  const HEIGHT_UNIT = col('[Growth] Height Unit')
  const WEIGHT = col('[Growth] Weight')
  const WEIGHT_UNIT = col('[Growth] Weight Unit')
  const SOLID_FOOD = col('[Solid Feed] Food')
  const SOLID_MEAL = col('[Solid Feed] Meal')
  const ROUTINE = col('[Routine] Routine')
  const DIAPER_TYPE = col('[Diaper] Type')
  const DIAPER_DETAIL = col('[Diaper] Detail')
  const DIAPER_COLOR = col('[Diaper] Dirty Color')
  const DIAPER_TEXTURE = col('[Diaper] Dirty Texture')

  const feedingEntries: FeedingEntry[] = []
  const sleepEntries: SleepEntry[] = []
  const diaperEntries: DiaperEntry[] = []
  const growthEntries: GrowthEntry[] = []
  const medicationEntries: MedicationEntry[] = []
  const bathEntries: BathEntry[] = []
  let skipped = 0
  let nextId = 0
  const newId = () => `nara-${nextId++}`

  for (const row of dataRows) {
    const note = row[NOTE] ?? ''

    switch (row[TYPE]) {
      case 'Bottle Feed': {
        const occurredAt = epochToIso(row[START_EPOCH])
        const breastMl = naraVolumeToMl(row[BREAST_VOL], row[BREAST_UNIT]) ?? 0
        const formulaMl = naraVolumeToMl(row[FORMULA_VOL], row[FORMULA_UNIT]) ?? 0
        const combinedMl = breastMl + formulaMl
        const volumeMl = combinedMl > 0 ? combinedMl : naraVolumeToMl(row[GENERIC_VOL], row[GENERIC_VOL_UNIT])
        feedingEntries.push({
          id: newId(),
          type: 'bottle',
          occurredAt,
          volumeMl,
          foodType: null,
          notes: note,
          createdBy: currentUserUid,
          createdAt: occurredAt,
        })
        break
      }
      case 'Solid Feed': {
        const occurredAt = epochToIso(row[START_EPOCH])
        const meal = row[SOLID_MEAL]
        feedingEntries.push({
          id: newId(),
          type: 'solid',
          occurredAt,
          volumeMl: null,
          foodType: row[SOLID_FOOD] || null,
          notes: note || (meal ? (NARA_MEAL_LABELS[meal] ?? meal) : ''),
          createdBy: currentUserUid,
          createdAt: occurredAt,
        })
        break
      }
      case 'Sleep': {
        const startedAt = epochToIso(row[START_EPOCH])
        sleepEntries.push({
          id: newId(),
          startedAt,
          endedAt: row[SLEEP_END_EPOCH] ? epochToIso(row[SLEEP_END_EPOCH]) : null,
          durationSeconds: row[SLEEP_DURATION] ? Number(row[SLEEP_DURATION]) : null,
          notes: note,
          createdBy: currentUserUid,
          createdAt: startedAt,
        })
        break
      }
      case 'Diaper': {
        const diaperType = NARA_DIAPER_TYPES[row[DIAPER_TYPE]]
        if (!diaperType) {
          skipped += 1
          break
        }
        const occurredAt = epochToIso(row[START_EPOCH])
        diaperEntries.push({
          id: newId(),
          type: diaperType,
          occurredAt,
          notes: joinNotes(note, row[DIAPER_DETAIL], row[DIAPER_COLOR], row[DIAPER_TEXTURE]),
          createdBy: currentUserUid,
          createdAt: occurredAt,
        })
        break
      }
      case 'Growth': {
        const measuredAt = epochToIso(row[START_EPOCH])
        growthEntries.push({
          id: newId(),
          measuredAt,
          weightG: naraWeightToGrams(row[WEIGHT], row[WEIGHT_UNIT]),
          heightMm: naraLengthToMm(row[HEIGHT], row[HEIGHT_UNIT]),
          headCircumferenceMm: naraLengthToMm(row[HEAD_SIZE], row[HEAD_UNIT]),
          notes: note,
          createdBy: currentUserUid,
          createdAt: measuredAt,
        })
        break
      }
      case 'Routine': {
        if (row[ROUTINE] === 'Vitamin/Probiotic') {
          const givenAt = epochToIso(row[START_EPOCH])
          medicationEntries.push({
            id: newId(),
            name: row[ROUTINE],
            givenAt,
            dose: '',
            notes: note,
            createdBy: currentUserUid,
            createdAt: givenAt,
          })
        } else if (row[ROUTINE] === 'Bath') {
          const occurredAt = epochToIso(row[START_EPOCH])
          bathEntries.push({ id: newId(), occurredAt, notes: note, createdBy: currentUserUid, createdAt: occurredAt })
        } else {
          skipped += 1
        }
        break
      }
      default:
        skipped += 1
    }
  }

  return {
    data: { feedingEntries, sleepEntries, diaperEntries, growthEntries, medicationEntries, bathEntries },
    skipped,
  }
}

function headerEquals(header: string[], expected: string[]): boolean {
  return header.length === expected.length && header.every((value, index) => value === expected[index])
}

export function parseImportFile(
  csv: string,
  currentUserUid: string,
): { data: BabyExport; skipped: number } {
  const rows = parseCsv(csv)
  if (rows.length === 0) {
    throw new Error('Empty file.')
  }
  const [header, ...dataRows] = rows

  if (headerEquals(header, NATIVE_HEADER)) {
    return { data: parseNativeRows(dataRows), skipped: 0 }
  }
  if (header[0] === 'Type' && header.includes('_familyKey')) {
    return parseNaraRows(header, dataRows, currentUserUid)
  }
  throw new Error('Unrecognized CSV file format.')
}

export async function importBabyData(
  householdId: string,
  babyId: string,
  data: BabyExport,
): Promise<void> {
  await Promise.all([
    importFeedingEntries(householdId, babyId, data.feedingEntries),
    importSleepEntries(householdId, babyId, data.sleepEntries),
    importDiaperEntries(householdId, babyId, data.diaperEntries),
    importGrowthEntries(householdId, babyId, data.growthEntries),
    importMedicationEntries(householdId, babyId, data.medicationEntries),
    importBathEntries(householdId, babyId, data.bathEntries),
  ])
}
