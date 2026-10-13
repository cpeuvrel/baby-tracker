import { deleteDoc } from 'firebase/firestore'
import { parseCsv, stripFormulaGuard, toCsv } from './csv'
import { secondsBetween } from './duration'
import { batchDeleteAll } from './firestoreBatch'
import {
  bathEntriesCollection,
  diaperEntriesCollection,
  feedingEntriesCollection,
  growthEntriesCollection,
  medicationEntriesCollection,
  pediatricianVisitsCollection,
  remindersCollection,
  sleepEntriesCollection,
  sleepTimerLockDoc,
} from './paths'
import { deleteBaby } from '../repositories/babies'
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

/** Deletes every logged entry for a baby (the baby and its settings are kept). Returns the count. */
export async function deleteAllBabyData(householdId: string, babyId: string): Promise<number> {
  const counts = await Promise.all(
    [
      feedingEntriesCollection,
      sleepEntriesCollection,
      diaperEntriesCollection,
      growthEntriesCollection,
      medicationEntriesCollection,
      bathEntriesCollection,
    ].map((collectionFor) => batchDeleteAll(collectionFor(householdId, babyId))),
  )
  return counts.reduce((sum, count) => sum + count, 0)
}

/** Deletes the sleep timer lock; firestore.rules allow it once the sleep it names is gone. */
async function deleteSleepTimerLock(householdId: string, babyId: string): Promise<void> {
  try {
    await deleteDoc(sleepTimerLockDoc(householdId, babyId))
  } catch (error) {
    // FirebaseError resets its prototype: `instanceof FirestoreError` would not match.
    if ((error as { code?: unknown } | null)?.code !== 'not-found') throw error
  }
}

/**
 * Deletes a baby with everything stored under it (entries, reminders, pediatrician visits, the
 * sleep timer lock): Firestore keeps subcollections of a deleted document, so they are emptied
 * first. Order matters: entries, then the lock (freed once its sleep is deleted), then the baby.
 */
export async function deleteBabyWithData(householdId: string, babyId: string): Promise<void> {
  await deleteAllBabyData(householdId, babyId)
  await Promise.all([
    ...[remindersCollection, pediatricianVisitsCollection].map((collectionFor) =>
      batchDeleteAll(collectionFor(householdId, babyId)),
    ),
    deleteSleepTimerLock(householdId, babyId),
  ])
  await deleteBaby(householdId, babyId)
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

const FEEDING_TYPES: readonly FeedingType[] = ['bottle', 'solid']
const DIAPER_TYPES: readonly DiaperType[] = ['wet', 'dirty', 'both', 'dry']

/** Reads the cells of one data row of a native file; `line` is its row number in the file. */
function nativeRowReader(row: string[], line: number) {
  const fail = (reason: string): never => {
    throw new Error(`Line ${line}: ${reason}.`)
  }
  const cell = (index: number) => stripFormulaGuard(row[index])
  const date = (index: number): string => {
    const value = cell(index)
    if (Number.isNaN(Date.parse(value))) fail(`invalid ${NATIVE_HEADER[index]} "${value}"`)
    return value
  }
  return {
    fail,
    text: cell,
    date,
    optionalDate: (index: number): string | null => (cell(index) === '' ? null : date(index)),
    number: (index: number): number | null => {
      const value = cell(index)
      if (value === '') return null
      const amount = Number(value)
      if (!Number.isFinite(amount)) fail(`invalid ${NATIVE_HEADER[index]} "${value}"`)
      return amount
    },
    oneOf: <T extends string>(index: number, allowed: readonly T[]): T => {
      const value = cell(index)
      if (!allowed.includes(value as T)) {
        fail(`invalid ${NATIVE_HEADER[index]} "${value}" (expected ${allowed.join(', ')})`)
      }
      return value as T
    },
  }
}

/**
 * Validates and reads the data rows of a native file. A malformed row (edited in a spreadsheet)
 * throws an error naming its line, before anything is written; a row of an unknown category is
 * counted as skipped.
 */
/** A stopped sleep without a duration column gets its length from its bounds (LIB-13). */
function sleepDurationOrNull(startedAt: string, endedAt: string | null): number | null {
  return endedAt ? secondsBetween(new Date(startedAt), new Date(endedAt)) : null
}

function parseNativeRows(
  dataRows: string[][],
  currentUserUid: string,
): { data: BabyExport; skipped: number } {
  const feedingEntries: FeedingEntry[] = []
  const sleepEntries: SleepEntry[] = []
  const diaperEntries: DiaperEntry[] = []
  const growthEntries: GrowthEntry[] = []
  const medicationEntries: MedicationEntry[] = []
  const bathEntries: BathEntry[] = []
  let skipped = 0
  let nextId = 0

  dataRows.forEach((row, index) => {
    const line = index + 2 // the header is line 1
    if (row.length !== NATIVE_HEADER.length) {
      throw new Error(`Line ${line}: expected ${NATIVE_HEADER.length} columns, found ${row.length}.`)
    }
    const read = nativeRowReader(row, line)
    const id = `native-${nextId++}`
    const at = () => read.date(AT)
    const common = (occurredAt: string) => ({
      notes: read.text(NOTES),
      createdBy: read.text(CREATED_BY) || currentUserUid,
      createdAt: read.text(CREATED_AT) === '' ? occurredAt : read.date(CREATED_AT),
    })

    switch (read.text(CATEGORY)) {
      case 'feeding': {
        const occurredAt = at()
        feedingEntries.push({
          id,
          type: read.oneOf(SUBTYPE, FEEDING_TYPES),
          occurredAt,
          volumeMl: read.number(VOLUME_ML),
          foodType: read.text(FOOD_TYPE) || null,
          ...common(occurredAt),
        })
        break
      }
      case 'sleep': {
        const startedAt = at()
        const endedAt = read.optionalDate(END_AT)
        sleepEntries.push({
          id,
          startedAt,
          endedAt,
          durationSeconds: read.number(DURATION) ?? sleepDurationOrNull(startedAt, endedAt),
          ...common(startedAt),
        })
        break
      }
      case 'diaper': {
        const occurredAt = at()
        diaperEntries.push({ id, type: read.oneOf(SUBTYPE, DIAPER_TYPES), occurredAt, ...common(occurredAt) })
        break
      }
      case 'growth': {
        const measuredAt = at()
        growthEntries.push({
          id,
          measuredAt,
          weightG: read.number(WEIGHT_G),
          heightMm: read.number(HEIGHT_MM),
          headCircumferenceMm: read.number(HEAD_MM),
          ...common(measuredAt),
        })
        break
      }
      case 'medication': {
        const givenAt = at()
        const name = read.text(MED_NAME)
        if (name.trim() === '') read.fail('missing medicationName')
        medicationEntries.push({ id, name, givenAt, dose: read.text(DOSE), ...common(givenAt) })
        break
      }
      case 'bath': {
        const occurredAt = at()
        bathEntries.push({ id, occurredAt, ...common(occurredAt) })
        break
      }
      default:
        skipped += 1
    }
  })

  return {
    data: { feedingEntries, sleepEntries, diaperEntries, growthEntries, medicationEntries, bathEntries },
    skipped,
  }
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

/** An epoch in milliseconds as ISO, or null when empty or not a number (`Number('')` is 1970). */
function epochToIso(value: string | undefined): string | null {
  if (value == null || value.trim() === '') return null
  const epoch = Number(value)
  return Number.isFinite(epoch) ? new Date(epoch).toISOString() : null
}

/** A number cell, or null when empty or unreadable (never NaN). */
function naraNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function naraVolumeToMl(value: string, unit: string): number | null {
  const amount = naraNumber(value)
  if (amount == null) return null
  return Math.round(unit === 'OZ' ? amount * 29.5735 : amount)
}

function naraWeightToGrams(value: string, unit: string): number | null {
  const amount = naraNumber(value)
  if (amount == null) return null
  if (unit === 'LB') return Math.round(amount * 453.592)
  if (unit === 'G') return Math.round(amount)
  return Math.round(amount * 1000)
}

function naraLengthToMm(value: string, unit: string): number | null {
  const amount = naraNumber(value)
  if (amount == null) return null
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
    // A row without a readable start time cannot be placed: skipped rather than dated 1970.
    const start = epochToIso(row[START_EPOCH])
    if (start === null) {
      skipped += 1
      continue
    }

    switch (row[TYPE]) {
      case 'Bottle Feed': {
        const occurredAt = start
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
        const occurredAt = start
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
        const startedAt = start
        const endedAt = epochToIso(row[SLEEP_END_EPOCH])
        sleepEntries.push({
          id: newId(),
          startedAt,
          endedAt,
          durationSeconds: naraNumber(row[SLEEP_DURATION]) ?? sleepDurationOrNull(startedAt, endedAt),
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
        const occurredAt = start
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
        const measuredAt = start
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
          const givenAt = start
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
          const occurredAt = start
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
    return parseNativeRows(dataRows, currentUserUid)
  }
  if (header[0] === 'Type' && header.includes('_familyKey')) {
    return parseNaraRows(header, dataRows, currentUserUid)
  }
  throw new Error('Unrecognized CSV file format.')
}

const MINUTE_MS = 60_000

/** The entry's time, to the minute (the app logs minutes; imported files may carry seconds). */
function timeKey(iso: string): string {
  return String(Math.floor(new Date(iso).getTime() / MINUTE_MS))
}

// An imported entry conflicts with an entry of the same category already logged at the same
// minute for this baby: the app's entry wins and the file's one is ignored, whatever their
// values. Medications are told apart by name, since two can be given at the same time.
const feedingKey = (e: FeedingEntry) => timeKey(e.occurredAt)
const sleepKey = (e: SleepEntry) => timeKey(e.startedAt)
const diaperKey = (e: DiaperEntry) => timeKey(e.occurredAt)
const growthKey = (e: GrowthEntry) => timeKey(e.measuredAt)
const medicationKey = (e: MedicationEntry) =>
  [e.name.trim().toLowerCase(), timeKey(e.givenAt)].join('|')
const bathKey = (e: BathEntry) => timeKey(e.occurredAt)

/** Keeps the incoming entries that match neither an existing entry nor an earlier incoming one. */
function withoutDuplicates<T>(incoming: T[], existing: T[], keyOf: (entry: T) => string): T[] {
  const seen = new Set(existing.map(keyOf))
  return incoming.filter((entry) => {
    const key = keyOf(entry)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface ImportResult {
  /** Entries actually written. */
  imported: number
  /** Entries matching one already logged in the app (or earlier in the file): ignored. */
  duplicates: number
  /** Sleeps still running in the file (no end): ignored, a stale timer cannot be resumed. */
  skippedRunning: number
}

/**
 * Imports the entries into the baby, ignoring those that conflict with the app (see the keys
 * above). Every written entry is authored by `currentUid`, whatever the file says: firestore.rules
 * only accept entries created by the signed-in user (an export may come from another account).
 */
export async function importBabyData(
  householdId: string,
  babyId: string,
  data: BabyExport,
  currentUid: string,
): Promise<ImportResult> {
  const [feeding, sleep, diaper, growth, medication, bath] = await Promise.all([
    getAllFeedingEntries(householdId, babyId),
    getAllSleepEntries(householdId, babyId),
    getAllDiaperEntries(householdId, babyId),
    getAllGrowthEntries(householdId, babyId),
    getAllMedicationEntries(householdId, babyId),
    getAllBathEntries(householdId, babyId),
  ])

  const fresh: BabyExport = {
    feedingEntries: withoutDuplicates(data.feedingEntries, feeding, feedingKey),
    sleepEntries: withoutDuplicates(data.sleepEntries, sleep, sleepKey),
    diaperEntries: withoutDuplicates(data.diaperEntries, diaper, diaperKey),
    growthEntries: withoutDuplicates(data.growthEntries, growth, growthKey),
    medicationEntries: withoutDuplicates(data.medicationEntries, medication, medicationKey),
    bathEntries: withoutDuplicates(data.bathEntries, bath, bathKey),
  }

  const freshSleeps = fresh.sleepEntries
  fresh.sleepEntries = freshSleeps.filter((entry) => entry.endedAt != null)
  const skippedRunning = freshSleeps.length - fresh.sleepEntries.length

  const authored = <T extends { createdBy: string }>(entries: T[]): T[] =>
    entries.map((entry) => ({ ...entry, createdBy: currentUid }))

  await Promise.all([
    importFeedingEntries(householdId, babyId, authored(fresh.feedingEntries)),
    importSleepEntries(householdId, babyId, authored(fresh.sleepEntries)),
    importDiaperEntries(householdId, babyId, authored(fresh.diaperEntries)),
    importGrowthEntries(householdId, babyId, authored(fresh.growthEntries)),
    importMedicationEntries(householdId, babyId, authored(fresh.medicationEntries)),
    importBathEntries(householdId, babyId, authored(fresh.bathEntries)),
  ])

  const imported = countEntries(fresh)
  return { imported, duplicates: countEntries(data) - imported - skippedRunning, skippedRunning }
}

export function countEntries(data: BabyExport): number {
  return (
    data.feedingEntries.length +
    data.sleepEntries.length +
    data.diaperEntries.length +
    data.growthEntries.length +
    data.medicationEntries.length +
    data.bathEntries.length
  )
}
