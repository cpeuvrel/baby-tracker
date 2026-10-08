import type { CollectionReference } from 'firebase/firestore'
import { describe, expect, it, vi } from 'vitest'
import { deleteBabyWithData } from './babyExport'

const deletedPaths: string[] = []

vi.mock('./firestoreBatch', () => ({
  batchInsert: vi.fn(),
  batchDeleteAll: async (ref: CollectionReference) => {
    deletedPaths.push(ref.path)
    return 0
  },
}))

vi.mock('../repositories/babies', () => ({
  deleteBaby: async (householdId: string, babyId: string) => {
    deletedPaths.push(`households/${householdId}/babies/${babyId}`)
  },
}))

describe('deleteBabyWithData', () => {
  it('empties every subcollection before deleting the baby', async () => {
    await deleteBabyWithData('h1', 'b1')

    const base = 'households/h1/babies/b1'
    expect(deletedPaths.slice(0, -1).sort()).toEqual(
      [
        'bathEntries',
        'diaperEntries',
        'feedingEntries',
        'growthEntries',
        'medicationEntries',
        'pediatricianVisits',
        'reminders',
        'sleepEntries',
      ].map((name) => `${base}/${name}`),
    )
    expect(deletedPaths.at(-1)).toBe(base)
  })
})
