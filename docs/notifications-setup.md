# Push notifications (FCM) in production

The app sends push notifications for the sleep timer, the medication
reminder and the vaccine reminders. The code (Cloud Functions, service
worker, settings) is in place and testable via the emulator. Two manual
actions still need to be done once in the Firebase console before
notifications work under real conditions:

## 1. Move to the Blaze plan

Firebase Console → Project Settings → Usage and billing →
switch to the **Blaze** plan (credit card required). Expected real cost ≈ €0/month
at this usage (2 users). Remember to set up a budget alert at €0/€1.

Needed because scheduled functions (`onSchedule`, Cloud Scheduler) aren't
available on the free "Spark" plan. The project declares **4 scheduled
jobs** (below); Cloud Scheduler includes 3 free jobs per billing account, so
the 4th costs about $0.10/month.

## 2. Generate the VAPID key (Web Push)

Firebase Console → Project Settings → Cloud Messaging → "Web configuration"
tab → **Generate key pair**. Copy the generated key into
`.env.local`:

```
VITE_FCM_VAPID_KEY=<generated key>
```

The service worker (`src/sw.ts`) reads the same `VITE_FIREBASE_*` values as
the page (`src/lib/firebaseConfig.ts`, substituted at build time): set them
once in the environment, there is no copy to keep in sync.

## 3. Deploy

```
firebase deploy --only functions,firestore:rules
```

Afterwards, functions are redeployed automatically by
`.github/workflows/deploy-functions.yml` on every push to `main` that touches
`functions/` (it can also be started by hand from the Actions tab), and the
Firestore rules and indexes by `.github/workflows/deploy-firestore.yml` on
every push to `main` that touches `firestore.rules` or `firestore.indexes.json`.

## What is sent

Every push is **data-only** (`functions/src/push.ts`, with a TTL past which
an undelivered push is dropped): the service worker
(`src/sw.ts`, `src/lib/backgroundPush.ts`) builds the notification itself,
whether the app is open or not. A device registers its token when the user
allows notifications (starting the sleep timer, choosing "Vaccine: Yes",
"Enable notifications" in the reminder settings) and unregisters it on
sign-out; tokens not seen for 60 days are dropped by the server.

Scheduled jobs (Cloud Scheduler, Paris time):

- `tickSleepTimerNotifications`, every minute: while a baby's sleep runs,
  refreshes its "Sleep Timer" notification (one per baby) with the elapsed
  time. `onSleepEntryWritten` shows it as soon as the sleep starts and closes
  it everywhere once none of the baby's sleeps runs (that push is kept up to
  24 h for a phone that is offline at that moment).
- `checkMedicationReminders`, every 15 minutes: once an active reminder's
  time has passed, sends "Reminder: Vitamin D" if no dose whose name starts
  like it ("Vitamin…") was logged that day. Sent at most once a day (the
  reminder records `lastSentOn`); a missed run catches up at the next one.
  A reminder set after 23:45 is never reached by a run that day.
- `askVaccinePurchase`, every day at 12:00: from 4 days before a visit
  marked "Vaccine: Yes" until the day before, asks "Vaccine bought?" with
  Yes/No buttons. "No" (or no answer) asks again the next day; "Yes" — on the
  notification or on the visit screen ("Vaccine bought") — stops the
  question, and `onPediatricianVisitWritten` clears it right away from every
  phone.
- `remindVaccineDay`, every day at 8:30: on the day of the visit, reminds to
  take the vaccine, whatever the answer.

## Testing locally without Blaze

`firebase emulators:start --only firestore,auth,functions,pubsub` then, in
the emulator UI (Functions tab), click "Trigger now" on
`checkMedicationReminders` (or another scheduled job) to trigger a manual run.
