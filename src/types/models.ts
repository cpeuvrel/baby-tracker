export interface Household {
  id: string
  name: string
  memberUids: string[]
}

export type BabySex = 'female' | 'male'

export interface Baby {
  id: string
  name: string
  birthDate: string
  sex: BabySex | null
}

export type FeedingType = 'bottle' | 'solid'

export interface FeedingEntry {
  id: string
  type: FeedingType
  occurredAt: string
  volumeMl: number | null
  foodType: string | null
  notes: string
  createdBy: string
  createdAt: string
}

export interface SleepEntry {
  id: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  notes: string
  createdBy: string
  createdAt: string
}

export type DiaperType = 'wet' | 'dirty' | 'both' | 'dry'

export interface DiaperEntry {
  id: string
  type: DiaperType
  occurredAt: string
  notes: string
  createdBy: string
  createdAt: string
}

export interface GrowthEntry {
  id: string
  measuredAt: string
  weightG: number | null
  heightMm: number | null
  headCircumferenceMm: number | null
  notes: string
  createdBy: string
  createdAt: string
}

export interface MedicationEntry {
  id: string
  name: string
  givenAt: string
  dose: string
  notes: string
  createdBy: string
  createdAt: string
}

export interface Reminder {
  id: string
  medicationName: string
  timeOfDay: string
  active: boolean
}

export interface FcmToken {
  id: string
  token: string
  createdAt: string
}
