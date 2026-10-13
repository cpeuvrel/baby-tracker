# Firestore Security Rules

`firestore.rules` is the only barrier between the database and the internet: the web config is public. The rules are tested by `rules/firestore.rules.test.ts` (`npm run test:rules`, Firestore emulator) in CI, and deployed by `.github/workflows/deploy-firestore.yml` on every push to `main` that touches them. Cloud Functions use the Admin SDK, which bypasses the rules.

## Who gets in
- `isAllowedEmail()`: signed in, `email_verified == true`, and the token's email (lower-cased) in the allowlist. The same list lives in `src/lib/allowedEmails.ts`; `src/lib/allowedEmails.test.ts` fails when they differ.
- `isHouseholdMember(h)`: allowlisted and `request.auth.uid` in `households/{h}.memberUids`. Everything under a household (babies, entries, locks) requires it.
- `users/{uid}/fcmTokens/{token}`: only the owner, and the document id must equal its `token` field (the functions send to the ids).
- Anything else is refused (`/{document=**}`).

## Households
- Create: `memberUids` must be a list of at most 4 uids that includes the creator.
- Update: allowed for members, but `memberUids` cannot change from the client (adding a member is done in the console / Admin SDK). Delete: never (it would orphan and lock out every subcollection).

## Field checks
Checks run on the document as it will be stored (`request.resource.data`), so a partial `updateDoc` is checked against the merged document. They type and bound the fields the app relies on, without `keys().hasOnly()`: older documents carry extra fields.
- Babies: `name` string of at most 80 characters; `photoDataUrl` absent, null or a string under 150 000 characters (a 320 px JPEG data URL is far smaller).
- Entries: the time field is a timestamp (`occurredAt` for feeding, diaper and bath, `measuredAt` for growth, `givenAt` for medication, `startedAt` for sleep; sleep `endedAt` is null or a timestamp); `notes` at most 2000 characters and `createdAt` a timestamp when present; on create only, `createdBy` must be the caller's uid (reminders have no author).
- Only the known collections can be written under a baby: `feedingEntries`, `sleepEntries`, `diaperEntries`, `bathEntries`, `growthEntries`, `medicationEntries`, `reminders`, `pediatricianVisits`, and `locks/sleepTimer`. A new collection needs a rule (and a test) before the app can write to it.

## The sleep timer lock
Goal: at most one running sleep (`endedAt == null`) per baby, even when two phones start a sleep at the same time or one of them is offline.

- `households/{h}/babies/{b}/locks/sleepTimer` holds `{ entryId }`: the id of the sleep that runs.
- A write that makes a sleep run (create with `endedAt: null`, or update from stopped to running) is accepted only if, after the write, the lock names that sleep (`getAfter(lock).data.entryId == entryId`). The client therefore writes the sleep and the lock in one batch (`writeRunningSleep` in `src/repositories/sleepEntries.ts`: `startSleep`, `resumeSleep`, `updateSleepEntry` without end).
- The lock can be taken (set) only when it is free, or re-set to the sleep it already names. It is free when it does not exist, when the sleep it names was deleted or has stopped, or when it is malformed (no string `entryId`), so a broken lock can never block the timer.
- Stopping a sleep (`stopSleep`) or deleting it does not touch the lock: the lock simply becomes free. Edits that keep a running sleep running (`updateSleepStart`, notes) need no lock.
- Only `{ entryId: string }` is accepted as a lock; other documents in `locks` are refused.
- When the batch is refused, the client shows "Another sleep timer is already running" (`src/lib/sleepAlreadyRunning.ts`).

Scenarios covered by the tests: running sleep without lock refused (a); sleep + lock batch accepted (b); a second running sleep refused (c); stopping (d) or deleting (e) the running sleep frees the lock; editing a running sleep without the lock (f); direct lock writes that break the rule refused (g); resume; malformed lock.
