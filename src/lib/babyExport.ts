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
  DiaperEntry,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

export const EXPORT_FORMAT_VERSION = 1

export interface BabyExport {
  formatVersion: typeof EXPORT_FORMAT_VERSION
  exportedAt: string
  baby: Pick<Baby, 'name' | 'birthDate'>
  feedingEntries: FeedingEntry[]
  sleepEntries: SleepEntry[]
  diaperEntries: DiaperEntry[]
  growthEntries: GrowthEntry[]
  medicationEntries: MedicationEntry[]
}

export async function exportBabyData(householdId: string, baby: Baby): Promise<BabyExport> {
  const [feedingEntries, sleepEntries, diaperEntries, growthEntries, medicationEntries] =
    await Promise.all([
      getAllFeedingEntries(householdId, baby.id),
      getAllSleepEntries(householdId, baby.id),
      getAllDiaperEntries(householdId, baby.id),
      getAllGrowthEntries(householdId, baby.id),
      getAllMedicationEntries(householdId, baby.id),
    ])

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    baby: { name: baby.name, birthDate: baby.birthDate },
    feedingEntries,
    sleepEntries,
    diaperEntries,
    growthEntries,
    medicationEntries,
  }
}

export function serializeBabyExport(data: BabyExport): string {
  return JSON.stringify(data, null, 2)
}

export function parseBabyExport(json: string): BabyExport {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Fichier invalide : JSON illisible.')
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { formatVersion?: unknown }).formatVersion !== EXPORT_FORMAT_VERSION
  ) {
    throw new Error("Format d'export non reconnu ou version incompatible.")
  }
  return data as BabyExport
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
  ])
}
