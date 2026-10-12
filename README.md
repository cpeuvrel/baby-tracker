# baby-tracker

Shared baby tracker (feeds, sleep, diapers, growth, medication, pediatrician visits) for two parents: a React + Vite PWA on Firebase (Auth, Firestore, Cloud Functions, FCM), hosted on Vercel.

## Prerequisites
- Node 24 (`engines` in `package.json`), Java 11+ for the Firebase emulators.
- `npm ci` at the root and in `functions/` (firebase-tools comes from `functions/node_modules`).

## Local development
1. `cp .env.example .env.local` and fill in the Firebase web config (`VITE_FCM_VAPID_KEY` only for push, see `docs/notifications-setup.md`). `.env.local` is ignored by git.
2. Start the emulators: `functions/node_modules/.bin/firebase emulators:start` (Auth, Firestore, Functions, Pub/Sub, UI).
3. Seed them: `npm run seed:emulator` (creates the shared account with a dev password and a demo household).
4. `npm run dev`, then sign in with the "Local sign-in (emulator)" form. `npm run dev:live` uses the real project instead (real data).

## Checks
- `npm test` (app suite), `npm run test:coverage` (with the 80 % thresholds, as CI runs it).
- `npm run test:rules`: `firestore.rules` against the Firestore emulator (`rules/`).
- `npm run lint`, `npm run build`; in `functions/`: `npm test`, `npm run build`.

## Deployment (all from `main`)
- App: Vercel deploys every push; previews are added to Firebase Auth's authorized domains by `preview-auth-domain.yml`.
- Functions: `deploy-functions.yml` on changes under `functions/` or `firebase.json`.
- Firestore rules and indexes: `deploy-firestore.yml` on changes to `firestore.rules` or `firestore.indexes.json` (rules tests run first).
- GitHub secret: `FIREBASE_SERVICE_ACCOUNT` (service account JSON key used by the three Firebase workflows).
- Dependabot minor/patch PRs are merged automatically once CI (`ci.yml`) passes.

## Access
One shared Google account. Its address is allowlisted in `src/lib/allowedEmails.ts` and in `firestore.rules` (a test keeps them identical); the rules also require a verified email and household membership (`memberUids`).

## Docs
`docs/plan.md` (product plan and history), `docs/firestore-rules.md` (rules and sleep lock), `docs/notifications-setup.md` (push setup), `docs/export-format.md` (CSV import/export), `docs/code-review/` (reviews).
