// Seed de données de dev pour le Firebase Local Emulator Suite (Firestore + Auth).
// Ne touche jamais le projet Firebase réel : nécessite les émulateurs démarrés.
//
// Depuis la migration vers Google Sign-In avec un compte partagé (plan.md,
// section 1b), il n'y a plus de mot de passe à pré-créer : il faut d'abord se
// connecter une fois dans l'app ("Sign in with Google", taper l'email ci-dessous
// sur l'écran factice de l'Auth Emulator) pour que le compte existe, PUIS lancer
// ce script pour créer le household/baby de démo rattachés à ce compte.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

const PROJECT_ID = 'baby-tracker-c8fd2'
const SHARED_ACCOUNT_EMAIL = 'amandineandcorentin@gmail.com'

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

let uid
try {
  uid = (await auth.getUserByEmail(SHARED_ACCOUNT_EMAIL)).uid
} catch {
  console.error(
    `Aucun compte pour ${SHARED_ACCOUNT_EMAIL} dans l'Auth Emulator.\n` +
      'Ouvre l\'app, clique "Sign in with Google", et tape cet email sur l\'écran ' +
      'factice de connexion de l\'émulateur — puis relance ce script.',
  )
  process.exit(1)
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
console.log(`Household: demo-household (memberUids: ["${uid}"]) — Baby: demo-baby`)

process.exit(0)
