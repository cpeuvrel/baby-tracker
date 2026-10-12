// Security Rules tests: run against the Firestore emulator with `npm run test:rules`.
// Each client write of src/repositories (create, partial update, import batch, delete) is
// replayed here with the same document shape, so a rule change cannot silently break the app.
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const ALLOWED_EMAIL = 'amandineandcorentin@gmail.com'
const HOUSEHOLD = 'households/h1'
const BABY = `${HOUSEHOLD}/babies/b1`
const LOCK = `${BABY}/locks/sleepTimer`

let env: RulesTestEnvironment

/** The test context's Firestore works with the modular API; only its declared type is the compat one. */
function firestoreOf(context: RulesTestContext): Firestore {
  return context.firestore() as unknown as Firestore
}

/** The shared account, member of h1. */
function parent(): Firestore {
  return firestoreOf(env.authenticatedContext('parent', { email: ALLOWED_EMAIL, email_verified: true }))
}

/** Listed in memberUids, but its email is not allowlisted. */
function stranger(): Firestore {
  return firestoreOf(env.authenticatedContext('stranger', { email: 'x@gmail.com', email_verified: true }))
}

/** Allowlisted email, but not a member of h1. */
function notMember(): Firestore {
  return firestoreOf(env.authenticatedContext('other', { email: ALLOWED_EMAIL, email_verified: true }))
}

/** Allowlisted email and member of h1, but the email is not verified. */
function unverified(): Firestore {
  return firestoreOf(env.authenticatedContext('unverified', { email: ALLOWED_EMAIL, email_verified: false }))
}

function anonymous(): Firestore {
  return firestoreOf(env.unauthenticatedContext())
}

async function seed(path: string, data: DocumentData): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(firestoreOf(context), path), data)
  })
}

const at = (iso: string) => Timestamp.fromDate(new Date(iso))

function runningSleep(createdBy = 'parent'): DocumentData {
  return {
    startedAt: at('2026-10-12T20:00:00Z'),
    endedAt: null,
    durationSeconds: null,
    notes: '',
    createdBy,
    createdAt: Timestamp.now(),
  }
}

/** startSleep / resumeSleep / updateSleepEntry without end: the sleep and its lock in one batch. */
function writeRunningSleep(db: Firestore, entryId: string, data: DocumentData, isNew = true) {
  const batch = writeBatch(db)
  const entryRef = doc(db, `${BABY}/sleepEntries/${entryId}`)
  if (isNew) batch.set(entryRef, data)
  else batch.update(entryRef, data)
  batch.set(doc(db, LOCK), { entryId })
  return batch.commit()
}

beforeAll(async () => {
  // Host and port come from FIRESTORE_EMULATOR_HOST, set by `firebase emulators:exec`.
  env = await initializeTestEnvironment({
    projectId: 'demo-baby-tracker',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(HOUSEHOLD, { name: 'My Family', memberUids: ['parent', 'stranger', 'unverified'] })
  await seed(BABY, { name: 'Baby', birthDate: '2025-06-01', sex: null })
})

describe('access control', () => {
  it('lets the allowlisted member read and write the household tree', async () => {
    await assertSucceeds(getDoc(doc(parent(), HOUSEHOLD)))
    await assertSucceeds(getDoc(doc(parent(), BABY)))
    await assertSucceeds(getDocs(collection(parent(), `${BABY}/feedingEntries`)))
    await assertSucceeds(updateDoc(doc(parent(), BABY), { name: 'Renamed' }))
  })

  it('finds the household with the app membership query', async () => {
    const db = parent()
    await assertSucceeds(
      getDocs(query(collection(db, 'households'), where('memberUids', 'array-contains', 'parent'), limit(1))),
    )
  })

  it('refuses an email outside the allowlist, even listed in memberUids', async () => {
    const db = stranger()
    await assertFails(getDoc(doc(db, HOUSEHOLD)))
    await assertFails(getDoc(doc(db, BABY)))
    await assertFails(getDocs(collection(db, `${BABY}/feedingEntries`)))
    await assertFails(updateDoc(doc(db, BABY), { name: 'Hacked' }))
    await assertFails(setDoc(doc(db, 'users/stranger/fcmTokens/t'), { token: 't' }))
  })

  it('refuses an allowlisted email whose address is not verified', async () => {
    const db = unverified()
    await assertFails(getDoc(doc(db, HOUSEHOLD)))
    await assertFails(getDoc(doc(db, BABY)))
    await assertFails(addDoc(collection(db, 'households'), { name: 'F', memberUids: ['unverified'] }))
    await assertFails(setDoc(doc(db, 'users/unverified/fcmTokens/t'), { token: 't' }))
  })

  it('refuses an allowlisted uid that is not a member', async () => {
    const db = notMember()
    await assertFails(getDoc(doc(db, HOUSEHOLD)))
    await assertFails(getDoc(doc(db, BABY)))
    await assertFails(getDocs(collection(db, `${BABY}/feedingEntries`)))
    await assertFails(updateDoc(doc(db, HOUSEHOLD), { name: 'Mine' }))
    await assertFails(setDoc(doc(db, `${BABY}/feedingEntries/x`), { occurredAt: Timestamp.now(), createdBy: 'other' }))
  })

  it('refuses signed-out requests', async () => {
    await assertFails(getDoc(doc(anonymous(), HOUSEHOLD)))
    await assertFails(getDoc(doc(anonymous(), BABY)))
  })

  it('refuses everything outside the known paths', async () => {
    await assertFails(getDoc(doc(parent(), 'users/parent')))
    await assertFails(setDoc(doc(parent(), 'users/parent'), { a: 1 }))
    await assertFails(setDoc(doc(parent(), 'other/x'), { a: 1 }))
  })
})

describe('households', () => {
  it('creates a household like createHousehold', async () => {
    await assertSucceeds(addDoc(collection(parent(), 'households'), { name: 'My Family', memberUids: ['parent'] }))
  })

  it('refuses a household that does not list the creator', async () => {
    await assertFails(addDoc(collection(parent(), 'households'), { name: 'F', memberUids: ['someone'] }))
  })

  it('refuses memberUids that is not a list of at most 4 uids', async () => {
    const db = parent()
    await assertFails(addDoc(collection(db, 'households'), { name: 'F', memberUids: 'parent' }))
    await assertFails(addDoc(collection(db, 'households'), { name: 'F', memberUids: { parent: true } }))
    await assertFails(
      addDoc(collection(db, 'households'), { name: 'F', memberUids: ['parent', 'a', 'b', 'c', 'd'] }),
    )
  })

  it('lets a member rename the household but not change its members', async () => {
    const db = parent()
    await assertSucceeds(updateDoc(doc(db, HOUSEHOLD), { name: 'Renamed' }))
    await assertFails(updateDoc(doc(db, HOUSEHOLD), { memberUids: ['stranger', 'unverified'] }))
    await assertFails(updateDoc(doc(db, HOUSEHOLD), { memberUids: ['parent', 'stranger', 'unverified', 'x'] }))
  })

  it('refuses deleting a household', async () => {
    await assertFails(deleteDoc(doc(parent(), HOUSEHOLD)))
  })
})

describe('babies', () => {
  it('accepts every write of src/repositories/babies.ts', async () => {
    const db = parent()
    const ref = await assertSucceeds(
      addDoc(collection(db, `${HOUSEHOLD}/babies`), { name: 'Léa', birthDate: '2026-01-02', sex: 'female' }),
    )
    await assertSucceeds(updateDoc(ref, { name: 'Léa B', birthDate: '2026-01-03', sex: null }))
    await assertSucceeds(updateDoc(ref, { nighttimeHours: { start: '20:00', end: '07:00' } }))
    await assertSucceeds(updateDoc(ref, { photoDataUrl: `data:image/jpeg;base64,${'A'.repeat(60_000)}` }))
    await assertSucceeds(updateDoc(ref, { photoDataUrl: null }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('accepts a partial update of a legacy baby without sex', async () => {
    await seed(BABY, { name: 'Demo Baby', birthDate: '2025-06-01' })
    await assertSucceeds(updateDoc(doc(parent(), BABY), { nighttimeHours: { start: '19:30', end: '07:00' } }))
  })

  it('refuses a missing, non-string or too long name', async () => {
    const db = parent()
    const babies = collection(db, `${HOUSEHOLD}/babies`)
    await assertFails(addDoc(babies, { birthDate: '2026-01-02', sex: null }))
    await assertFails(addDoc(babies, { name: 42, birthDate: '2026-01-02' }))
    await assertFails(addDoc(babies, { name: 'x'.repeat(81), birthDate: '2026-01-02' }))
  })

  it('refuses an oversized or non-string photo', async () => {
    const db = parent()
    await assertFails(updateDoc(doc(db, BABY), { photoDataUrl: 'A'.repeat(150_000) }))
    await assertFails(updateDoc(doc(db, BABY), { photoDataUrl: 12 }))
  })
})

const NOW = Timestamp.now()

/** One client-written shape per entry collection: [collection, create data, partial update data]. */
const ENTRY_SHAPES: [string, DocumentData, DocumentData][] = [
  [
    'feedingEntries',
    { type: 'bottle', occurredAt: NOW, volumeMl: 120, foodType: null, notes: '', createdBy: 'parent', createdAt: NOW },
    { type: 'solid', occurredAt: NOW, volumeMl: null, foodType: 'Carrot', notes: 'ok' },
  ],
  [
    'diaperEntries',
    { type: 'wet', occurredAt: NOW, notes: '', createdBy: 'parent', createdAt: NOW },
    { type: 'dirty', occurredAt: NOW, notes: 'x' },
  ],
  [
    'bathEntries',
    { occurredAt: NOW, notes: '', createdBy: 'parent', createdAt: NOW },
    { occurredAt: NOW, notes: 'warm' },
  ],
  [
    'growthEntries',
    {
      measuredAt: NOW,
      weightG: 4200,
      heightMm: 540,
      headCircumferenceMm: null,
      notes: '',
      createdBy: 'parent',
      createdAt: NOW,
    },
    { measuredAt: NOW, weightG: 4300, heightMm: null, headCircumferenceMm: 380, notes: '' },
  ],
  [
    'medicationEntries',
    { name: 'Vitamin D', givenAt: NOW, dose: '1 drop', notes: '', createdBy: 'parent', createdAt: NOW },
    { name: 'Vitamin D', givenAt: NOW, dose: '2 drops', notes: '' },
  ],
  [
    'pediatricianVisits',
    {
      date: '2026-11-02',
      vaccinated: true,
      vaccineBought: false,
      remarks: [],
      discussions: [],
      createdBy: 'parent',
      createdAt: NOW,
    },
    { vaccineBought: true, remarks: [{ id: 'r1', text: 'Fever' }] },
  ],
]

const TIME_FIELDS: Record<string, string> = {
  feedingEntries: 'occurredAt',
  diaperEntries: 'occurredAt',
  bathEntries: 'occurredAt',
  growthEntries: 'measuredAt',
  medicationEntries: 'givenAt',
}

describe.each(ENTRY_SHAPES)('%s', (name, created, changes) => {
  const path = `${BABY}/${name}`

  it('accepts log, partial update and delete', async () => {
    const db = parent()
    const ref = await assertSucceeds(addDoc(collection(db, path), created))
    await assertSucceeds(updateDoc(ref, changes))
    await assertSucceeds(deleteDoc(ref))
  })

  it('accepts an import batch (createdAt in the past)', async () => {
    const db = parent()
    const batch = writeBatch(db)
    for (let i = 0; i < 3; i++) {
      batch.set(doc(collection(db, path)), { ...created, createdAt: at('2025-01-01T00:00:00Z') })
    }
    await assertSucceeds(batch.commit())
  })

  it('refuses a create attributed to someone else', async () => {
    await assertFails(addDoc(collection(parent(), path), { ...created, createdBy: 'stranger' }))
    const { createdBy: _omitted, ...withoutAuthor } = created
    await assertFails(addDoc(collection(parent(), path), withoutAuthor))
  })

  it('refuses notes longer than 2000 characters and a non-timestamp createdAt', async () => {
    await assertFails(addDoc(collection(parent(), path), { ...created, notes: 'x'.repeat(2001) }))
    await assertFails(addDoc(collection(parent(), path), { ...created, createdAt: '2026-10-12' }))
  })

  const timeField = TIME_FIELDS[name]
  if (timeField) {
    it(`refuses ${timeField} when it is not a timestamp`, async () => {
      const db = parent()
      await assertFails(addDoc(collection(db, path), { ...created, [timeField]: '2026-10-12T10:00:00Z' }))
      const ref = await assertSucceeds(addDoc(collection(db, path), created))
      await assertFails(updateDoc(ref, { [timeField]: null }))
    })
  }

  it('accepts a partial update of a legacy entry written by another account', async () => {
    const legacy: DocumentData = { ...created, createdBy: 'old-uid' }
    delete legacy.notes
    await seed(`${path}/legacy`, legacy)
    await assertSucceeds(updateDoc(doc(parent(), `${path}/legacy`), { notes: 'later' }))
  })
})

describe('reminders', () => {
  it('accepts setReminder (create then overwrite)', async () => {
    const db = parent()
    const ref = doc(db, `${BABY}/reminders/Vitamin D`)
    await assertSucceeds(setDoc(ref, { medicationName: 'Vitamin D', timeOfDay: '09:00', active: true }))
    await assertSucceeds(setDoc(ref, { medicationName: 'Vitamin D', timeOfDay: '10:00', active: false }))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(deleteDoc(ref))
  })
})

describe('unknown collections under a baby', () => {
  it('can be read and deleted but not written', async () => {
    const db = parent()
    await seed(`${BABY}/whateverCollection/x`, { a: 1 })
    await assertSucceeds(getDoc(doc(db, `${BABY}/whateverCollection/x`)))
    await assertFails(setDoc(doc(db, `${BABY}/whateverCollection/y`), { createdBy: 'parent' }))
    await assertFails(updateDoc(doc(db, `${BABY}/whateverCollection/x`), { a: 2 }))
    await assertSucceeds(deleteDoc(doc(db, `${BABY}/whateverCollection/x`)))
  })
})

describe('sleep timer lock', () => {
  const sleep = (id: string) => `${BABY}/sleepEntries/${id}`

  it('(a) refuses a running sleep written without the lock', async () => {
    await assertFails(setDoc(doc(parent(), sleep('s1')), runningSleep()))
  })

  it('(b) accepts a running sleep written with its lock (startSleep)', async () => {
    await assertSucceeds(writeRunningSleep(parent(), 's1', runningSleep()))
  })

  it('(c) refuses a second running sleep while one runs', async () => {
    const db = parent()
    await writeRunningSleep(db, 's1', runningSleep())
    await assertFails(writeRunningSleep(db, 's2', runningSleep()))
  })

  it('(d) frees the lock when the sleep stops (stopSleep), without touching the lock', async () => {
    const db = parent()
    await writeRunningSleep(db, 's1', runningSleep())
    await assertSucceeds(updateDoc(doc(db, sleep('s1')), { endedAt: Timestamp.now(), durationSeconds: 3600 }))
    await assertSucceeds(writeRunningSleep(db, 's2', runningSleep()))
  })

  it('(e) frees the lock when the running sleep is deleted', async () => {
    const db = parent()
    await writeRunningSleep(db, 's1', runningSleep())
    await assertSucceeds(deleteDoc(doc(db, sleep('s1'))))
    await assertSucceeds(writeRunningSleep(db, 's2', runningSleep()))
  })

  it('(f) edits a running sleep without the lock when it keeps running (updateSleepStart)', async () => {
    const db = parent()
    await writeRunningSleep(db, 's1', runningSleep())
    await assertSucceeds(updateDoc(doc(db, sleep('s1')), { startedAt: at('2026-10-12T19:30:00Z') }))
    await assertSucceeds(updateDoc(doc(db, sleep('s1')), { notes: 'x' }))
  })

  it('(g) refuses lock writes that do not follow the lock rule', async () => {
    const db = parent()
    await writeRunningSleep(db, 's1', runningSleep())
    // Another doc in locks only matches the wildcard, which excludes locks.
    await assertFails(setDoc(doc(db, `${BABY}/locks/other`), { entryId: 's2' }))
    // Taking or releasing the lock of a running sleep directly.
    await assertFails(setDoc(doc(db, LOCK), { entryId: 's2' }))
    await assertFails(deleteDoc(doc(db, LOCK)))
  })

  it('resumes a stopped sleep with the lock (resumeSleep, updateSleepEntry without end)', async () => {
    const db = parent()
    await seed(sleep('s1'), { ...runningSleep(), endedAt: Timestamp.now(), durationSeconds: 60 })
    await assertSucceeds(
      writeRunningSleep(db, 's1', { startedAt: at('2026-10-12T20:00:00Z'), endedAt: null, durationSeconds: null }, false),
    )
    // s1 runs again: it holds the lock.
    await assertFails(writeRunningSleep(db, 's2', runningSleep()))
  })

  it('refuses resuming a stopped sleep while another one runs', async () => {
    const db = parent()
    await seed(sleep('s1'), { ...runningSleep(), endedAt: Timestamp.now(), durationSeconds: 60 })
    await writeRunningSleep(db, 's2', runningSleep())
    await assertFails(writeRunningSleep(db, 's1', { endedAt: null, durationSeconds: null }, false))
  })

  it('accepts logSleep, an edit with an end, an import batch and a delete', async () => {
    const db = parent()
    const stopped = { ...runningSleep(), endedAt: at('2026-10-12T21:00:00Z'), durationSeconds: 3600 }
    const ref = await assertSucceeds(addDoc(collection(db, `${BABY}/sleepEntries`), stopped))
    await assertSucceeds(
      updateDoc(ref, {
        startedAt: at('2026-10-12T20:10:00Z'),
        endedAt: at('2026-10-12T21:10:00Z'),
        durationSeconds: 3600,
        notes: 'good',
      }),
    )
    const batch = writeBatch(db)
    batch.set(doc(collection(db, `${BABY}/sleepEntries`)), { ...stopped, createdAt: at('2025-01-01T00:00:00Z') })
    batch.set(doc(collection(db, `${BABY}/sleepEntries`)), { ...stopped, createdAt: at('2025-01-01T00:00:00Z') })
    await assertSucceeds(batch.commit())
    await assertSucceeds(deleteDoc(ref))
  })

  it('refuses malformed sleeps', async () => {
    const db = parent()
    const stopped = { ...runningSleep(), endedAt: at('2026-10-12T21:00:00Z'), durationSeconds: 3600 }
    const sleeps = collection(db, `${BABY}/sleepEntries`)
    await assertFails(addDoc(sleeps, { ...stopped, createdBy: 'stranger' }))
    await assertFails(addDoc(sleeps, { ...stopped, endedAt: '2026-10-12T21:00:00Z' }))
    await assertFails(addDoc(sleeps, { ...stopped, startedAt: '2026-10-12T20:00:00Z' }))
    await assertFails(addDoc(sleeps, { ...stopped, notes: 'x'.repeat(2001) }))
  })

  it('accepts only { entryId: string } as a lock', async () => {
    const db = parent()
    await assertFails(setDoc(doc(db, LOCK), { entryId: 's1', extra: true }))
    await assertFails(setDoc(doc(db, LOCK), { entryId: 5 }))
    await assertFails(setDoc(doc(db, LOCK), {}))
    await assertSucceeds(setDoc(doc(db, LOCK), { entryId: 'x' }))
  })

  it('treats a malformed lock as free, so it never blocks the timer', async () => {
    const db = parent()
    await seed(LOCK, {})
    await assertSucceeds(deleteDoc(doc(db, LOCK)))
    await seed(LOCK, { entryId: 42 })
    await assertSucceeds(writeRunningSleep(db, 's1', runningSleep()))
  })

  it('refuses another member-less or unverified account to take the lock', async () => {
    await assertFails(writeRunningSleep(notMember(), 's1', runningSleep('other')))
    await assertFails(writeRunningSleep(unverified(), 's1', runningSleep('unverified')))
  })
})

describe('FCM tokens', () => {
  it('lets a user save, read and delete its own token (id = token)', async () => {
    const db = parent()
    const ref = doc(db, 'users/parent/fcmTokens/tok:123')
    await assertSucceeds(setDoc(ref, { token: 'tok:123', createdAt: Timestamp.now() }))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(setDoc(ref, { token: 'tok:123', createdAt: Timestamp.now() }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('refuses a token stored under another id', async () => {
    await assertFails(setDoc(doc(parent(), 'users/parent/fcmTokens/abc'), { token: 'def' }))
    await assertFails(setDoc(doc(parent(), 'users/parent/fcmTokens/abc'), { createdAt: Timestamp.now() }))
  })

  it("refuses another uid's tokens", async () => {
    await seed('users/parent/fcmTokens/t', { token: 't' })
    const db = notMember()
    await assertFails(getDoc(doc(db, 'users/parent/fcmTokens/t')))
    await assertFails(setDoc(doc(db, 'users/parent/fcmTokens/u'), { token: 'u' }))
    await assertFails(deleteDoc(doc(db, 'users/parent/fcmTokens/t')))
  })
})
