// Seed de données de dev pour le Firebase Local Emulator Suite (Firestore + Auth).
// Ne touche jamais le projet Firebase réel : nécessite les émulateurs démarrés.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

const PROJECT_ID = 'baby-tracker-c8fd2'
const PARENTS = [
  { email: 'parent1@example.com', password: 'password123' },
  { email: 'parent2@example.com', password: 'password123' },
]

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

async function ensureUser({ email, password }) {
  try {
    const existing = await auth.getUserByEmail(email)
    return existing.uid
  } catch {
    const created = await auth.createUser({ email, password, emailVerified: true })
    return created.uid
  }
}

const uids = await Promise.all(PARENTS.map(ensureUser))

await db.collection('households').doc('demo-household').set({
  name: 'Famille Demo',
  memberUids: uids,
})

await db
  .collection('households')
  .doc('demo-household')
  .collection('babies')
  .doc('demo-baby')
  .set({
    name: 'Bébé Demo',
    birthDate: '2025-06-01',
  })

console.log('Seed terminé.')
console.log('Comptes de test :')
for (const parent of PARENTS) {
  console.log(`  - ${parent.email} / ${parent.password}`)
}
console.log('Household: demo-household — Baby: demo-baby')

process.exit(0)
