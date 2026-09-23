// Dev data seed for the Firebase Local Emulator Suite (Firestore + Auth).
// Never touches the real Firebase project: requires the emulators to be running.
//
// The script creates the shared account with a dev password if needed, so you
// can sign in via the "Local sign-in (emulator)" form on the login screen
// without depending on the Google flow.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

const PROJECT_ID = 'baby-tracker-c8fd2'
const SHARED_ACCOUNT_EMAIL = 'amandineandcorentin@gmail.com'
// Dev password, only valid in the Auth Emulator (never in prod).
const DEV_PASSWORD = 'password123'

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

let uid
try {
  uid = (await auth.getUserByEmail(SHARED_ACCOUNT_EMAIL)).uid
  await auth.updateUser(uid, { password: DEV_PASSWORD, emailVerified: true })
  console.log(`Existing account ${SHARED_ACCOUNT_EMAIL} — dev password reset.`)
} catch {
  const created = await auth.createUser({
    email: SHARED_ACCOUNT_EMAIL,
    password: DEV_PASSWORD,
    emailVerified: true,
  })
  uid = created.uid
  console.log(`Account ${SHARED_ACCOUNT_EMAIL} created in the Auth Emulator.`)
}

// Don't create a second household: the app's query takes the first one found,
// a demo household would hide the real dev data.
const existingHouseholds = await db
  .collection('households')
  .where('memberUids', 'array-contains', uid)
  .get()

if (!existingHouseholds.empty) {
  const existing = existingHouseholds.docs[0]
  console.log(`Household already present (${existing.id}): Firestore seeding skipped.`)
  console.log(`Local sign-in: ${SHARED_ACCOUNT_EMAIL} / ${DEV_PASSWORD}`)
  process.exit(0)
}

await db.collection('households').doc('demo-household').set({
  name: 'Demo Family',
  memberUids: [uid],
})

await db
  .collection('households')
  .doc('demo-household')
  .collection('babies')
  .doc('demo-baby')
  .set({
    name: 'Demo Baby',
    birthDate: '2025-06-01',
  })

console.log('Seed complete.')
console.log(`Local sign-in: ${SHARED_ACCOUNT_EMAIL} / ${DEV_PASSWORD}`)
console.log(`Household: demo-household (memberUids: ["${uid}"]) — Baby: demo-baby`)

process.exit(0)
