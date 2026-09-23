// Seed de données de dev pour le Firebase Local Emulator Suite (Firestore + Auth).
// Ne touche jamais le projet Firebase réel : nécessite les émulateurs démarrés.
//
// Le script crée au besoin le compte partagé avec un mot de passe de dev, pour
// pouvoir se connecter via le formulaire "Local sign-in (emulator)" de l'écran
// de login sans dépendre du flow Google.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

const PROJECT_ID = 'baby-tracker-c8fd2'
const SHARED_ACCOUNT_EMAIL = 'amandineandcorentin@gmail.com'
// Mot de passe de dev, valable uniquement dans l'Auth Emulator (jamais en prod).
const DEV_PASSWORD = 'password123'

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

let uid
try {
  uid = (await auth.getUserByEmail(SHARED_ACCOUNT_EMAIL)).uid
  await auth.updateUser(uid, { password: DEV_PASSWORD, emailVerified: true })
  console.log(`Compte existant ${SHARED_ACCOUNT_EMAIL} — mot de passe de dev reinitialise.`)
} catch {
  const created = await auth.createUser({
    email: SHARED_ACCOUNT_EMAIL,
    password: DEV_PASSWORD,
    emailVerified: true,
  })
  uid = created.uid
  console.log(`Compte ${SHARED_ACCOUNT_EMAIL} cree dans l'Auth Emulator.`)
}

// Ne pas créer un second foyer : la requête de l'app prend le premier trouvé,
// un household de démo masquerait les vraies données de dev.
const existingHouseholds = await db
  .collection('households')
  .where('memberUids', 'array-contains', uid)
  .get()

if (!existingHouseholds.empty) {
  const existing = existingHouseholds.docs[0]
  console.log(`Foyer déjà présent (${existing.id}) : seeding Firestore ignoré.`)
  console.log(`Connexion locale : ${SHARED_ACCOUNT_EMAIL} / ${DEV_PASSWORD}`)
  process.exit(0)
}

await db.collection('households').doc('demo-household').set({
  name: 'Famille Demo',
  memberUids: [uid],
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
console.log(`Connexion locale : ${SHARED_ACCOUNT_EMAIL} / ${DEV_PASSWORD}`)
console.log(`Household: demo-household (memberUids: ["${uid}"]) — Baby: demo-baby`)

process.exit(0)
