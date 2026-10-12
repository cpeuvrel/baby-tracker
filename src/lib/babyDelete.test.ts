import type { CollectionReference, DocumentReference } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteBabyWithData } from './babyExport'

const deletedPaths: string[] = []
const deleteDocImpl = vi.fn(async (ref: DocumentReference) => {
  deletedPaths.push(ref.path)
})

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return { ...actual, deleteDoc: (ref: DocumentReference) => deleteDocImpl(ref) }
})

// Builds real Firestore references (only deleteDoc and the batch helpers are replaced).
vi.mock('./firebase', (importActual) => importActual())

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
  const base = 'households/h1/babies/b1'

  beforeEach(() => {
    deletedPaths.length = 0
    deleteDocImpl.mockClear()
  })

  it('empties every subcollection and the sleep timer lock before deleting the baby', async () => {
    await deleteBabyWithData('h1', 'b1')

    expect(deletedPaths.slice(0, -1).sort()).toEqual(
      [
        'bathEntries',
        'diaperEntries',
        'feedingEntries',
        'growthEntries',
        'locks/sleepTimer',
        'medicationEntries',
        'pediatricianVisits',
        'reminders',
        'sleepEntries',
      ].map((name) => `${base}/${name}`),
    )
    // The lock can only go once the sleep it names is deleted.
    expect(deletedPaths.indexOf(`${base}/locks/sleepTimer`)).toBeGreaterThan(
      deletedPaths.indexOf(`${base}/sleepEntries`),
    )
    expect(deletedPaths.at(-1)).toBe(base)
  })

  it('still deletes the baby when there is no lock to delete', async () => {
    deleteDocImpl.mockRejectedValueOnce(Object.assign(new Error('No document to delete'), { code: 'not-found' }))

    await deleteBabyWithData('h1', 'b1')

    expect(deletedPaths.at(-1)).toBe(base)
  })

  it('keeps the baby when the lock cannot be deleted for another reason', async () => {
    deleteDocImpl.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }))

    await expect(deleteBabyWithData('h1', 'b1')).rejects.toThrow('denied')
    expect(deletedPaths).not.toContain(base)
  })
})
