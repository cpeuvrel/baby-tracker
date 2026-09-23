# Enabling medication reminders (FCM) in production

The reminder code (entry, settings, Cloud Function, service worker) is in
place and testable via the emulator. Two manual actions still need to be
done once in the Firebase console before notifications work under real
conditions:

## 1. Move to the Blaze plan

Firebase Console → Project Settings → Usage and billing →
switch to the **Blaze** plan (credit card required). Expected real cost ≈ €0/month
at this usage (2 users). Remember to set up a budget alert at €0/€1.

Needed because scheduled functions (`onSchedule`, Cloud Scheduler) aren't
available on the free "Spark" plan.

## 2. Generate the VAPID key (Web Push)

Firebase Console → Project Settings → Cloud Messaging → "Web configuration"
tab → **Generate key pair**. Copy the generated key into
`.env.local`:

```
VITE_FCM_VAPID_KEY=<generated key>
```

## 3. Deploy

```
firebase deploy --only functions,firestore:rules
```

The `checkMedicationReminders` Cloud Function runs every 15 minutes and
sends a notification if an active reminder's medication hasn't been logged
that day.

## Testing locally without Blaze

`firebase emulators:start --only firestore,auth,functions,pubsub` then, in
the emulator UI (Functions tab), click "Trigger now" on
`checkMedicationReminders` to trigger a manual run.
