# baby-tracker — implementation plan

> Document meant to be handed to another Claude instance for implementation.
> Context: the app "Nara Baby & Mom Tracker" (used daily by both parents) is considered too expensive/locked-down by the user.
> Goal: a personal replacement app, restricted to 2 parents, whose **UX must match Nara's** (see section 6 — detailed screen patterns, do not re-research) so as not to break habits already formed.

> **Research note (confirmed)**: app identified = *Nara Baby & Pregnancy Tracker* (App Store, id1444639029) aka "Nara Baby & Mom Tracker" on nara.com, publisher Nara Organics, Inc. (US), English only, no French version. Freemium paywall + in-app purchases/subscription **already active**, not "coming soon" (confirmed via the App Store listing: "Free with in-app purchases").

> **Status (2026-09-23)**: all 7 phases (section 10) are implemented, along with the 8 additions outside the initial phasing below:
> 1. **UX overhaul of History and Trends** based on real screenshots of the user's Nara app (actual dark theme, baby "Maëlys") shared along the way — more accurate than the marketing screenshots used to write section 6 initially. Sections 6.1, 6.5 and 7 updated accordingly.
> 2. **Import/export switched to CSV only** (JSON dropped) with direct import of a real Nara GDPR export, format discovered and verified against a real 1882-line file. Section 9 updated, full detail in `docs/export-format.md`.
> 3. **WHO growth percentile curves implemented** (initially noted as "v1.1 extension, non-blocking" — sections 7/11 updated). Baby's sex added to the model (`sex: 'male' | 'female' | null` on `Baby`), WHO LMS tables (weight/height/head circumference, 9 reference percentiles) in `src/lib/whoGrowthData.ts` + computation in `src/lib/growthPercentiles.ts`, new `GrowthDetailPage` screen (same pattern as `TrendDetailPage`: percentile chart with the child's curve overlaid on reference curves, list view toggle, per-point callout with percentile/age/edit) accessible from each Growth row on the Activity screen. CDC not included (WHO only, unlike the initial "WHO/CDC" wording in section 7).
> 4. **Family → Account overhaul implemented** (2026-09-23), based on real screenshots of Nara's Account section. New screens `AccountPage` (Family/Settings list), rewritten `FamilyPage` (Children with a link to Child, no more inline form or Pregnancy section), `AddChildPage`, `ChildPage` (profile + computed Age + Settings + Export/Import Data, without Use Adjusted Age or Notes & Photos), `AccountSettingsPage` (signed-in account + Log out, without Communication), `EditActivitiesPage` (new, functional: hides/shows the Activity screen's cards via `useActivityVisibility`, `localStorage` persistence). `SettingsSection.tsx` removed (absorbed into `ChildPage`). The header's "⋯" menu (which only contained the logout) is removed, replaced by Account > Settings > Log out. `ExportImportSection` now takes `householdId`/`baby` as props instead of reading `selectedBaby` from context. Routes under `/account`, `/account/family`, `/account/family/add`, `/account/family/:babyId`, `/account/family/:babyId/activities`, `/account/settings` (sections 6.8, 9, 10 updated). Decided: no "Stop Tracking" (out of scope for v1). "Nighttime Hours" was then left as an open point, implemented since in addition 7 below.
> 5. **Authentication: migration to Google Sign-In implemented** (2026-09-23), replaces Email/Password. Carried over from Corentin's PR [#2](https://github.com/cpeuvrel/baby-tracker/pull/2) (a similar implementation to a first version built in parallel, but not identical — the PR's version was chosen as the base, see section 1b for detail). `AuthContext.tsx` (`loginWithGoogle()` via `GoogleAuthProvider`, replaces `login(email, password)`), `LoginPage.tsx` (a single "Sign in with Google" button + error message coming from the context), `firestore.rules` (adds an `isAllowedEmail()` function checking `request.auth.token.email`, **in addition to** the existing `memberUids` check — not a replacement). **Product decision**: a **single shared Google account** for both parents (`amandineandcorentin@gmail.com`), not two individual accounts as originally considered — as a result `households.ts`/`HouseholdContext.tsx`/`scripts/seed-emulator.mjs` (adapted, see point 6) **did not fundamentally change** (still `subscribeToHouseholdForUser(uid, ...)` filtered by `memberUids`, consistent since there's only ever a single uid). If the signed-in account's email is not in the allowlist, `AuthContext` automatically signs it out and shows the rejected account (e.g. "x@gmail.com is not authorized.") — handled client-side, not only via Security Rules. **Deviation from the original PR (settled after testing in prod): `signInWithPopup` everywhere, `signInWithRedirect` dropped.** The redirect was already failing locally against the Auth Emulator (`getRedirectResult` stays `null`, no error, no account created — open issues `firebase/firebase-js-sdk` #9108/#8652 and `firebase/firebase-tools` #6671/#6341), and **it also fails in deployed prod**: you pick your Google account and land back on the sign-in screen still signed out. Cause: `signInWithRedirect` needs access to storage shared between the app's domain (Vercel) and `authDomain` (`baby-tracker-c8fd2.firebaseapp.com`), which Chrome/Safari/Firefox now block (see "Best practices for using signInWithRedirect on browsers that block third-party storage access", Firebase docs). Popup works around the issue and works in both environments. **Alternative not adopted for now**: keep the redirect by serving the auth handler from the app's domain (Vercel rewrite of `/__/auth/**` to `baby-tracker-c8fd2.firebaseapp.com/__/auth/**` + `VITE_FIREBASE_AUTH_DOMAIN` pointing at the Vercel domain) — only do this if the popup causes problems on mobile.
> 6. **"Create Family" onboarding added** (2026-09-23): on first sign-in (no household existing for the account yet), the app showed a completely blank screen (several screens do `if (!household) return null`) — replaced with a welcome screen (`CreateFamilyPage.tsx`) prompting entry of the first child (First Name, Sex, Birthdate — **all 3 required**, including Sex, which has no native HTML validation since it isn't an `<input>`). On submit, it creates the household (`createHousehold()`, new in `households.ts` — `{ name: 'My Family', memberUids: [uid] }`) then the baby on it (`addBaby`). Once the household is created, the real-time subscription (`HouseholdContext`) automatically switches over to the normal app, with no manual navigation. `App.tsx` restructured: `BrowserRouter`/the routes are only mounted if a household exists; otherwise `CreateFamilyPage` is shown outside the layout (like `LoginPage`, no header/tab bar). The same "3 required fields" guard (including Sex) was added to `AddChildPage.tsx` (adding an extra child from Family), which didn't check for it until now.
> 7. **Child screen fidelity (section 6.8) completed** (2026-09-23), based on re-reviewed Nara screenshots: **Nighttime Hours implemented** (an open point since addition 4) — new `nighttimeHours: { start, end } | null` field on `Baby` (optional in the type so as not to break existing test fixtures), dedicated `NighttimeHoursPage.tsx` screen (From/To, same pattern as the other detail screens), `updateNighttimeHours()` in `babies.ts`. The nighttime wake-up calculation (section 7, `aggregations.ts`/`trendMetrics.ts`) now accepts a range as a parameter instead of a fixed constant (`DEFAULT_NIGHTTIME_HOURS`, aligned with Nara's default `20:00–08:00` — replaces the old internal `20h–7h` constant, used as a fallback for babies without a setting). **Metric/Imperial toggle removed** from the Child screen (absent from the Nara screenshots, defaulted to metric anyway — `useUnitPreference`/imperial formatting stay in the code for Growth, just no longer exposed as a setting here). **CSV import switched to 2 steps** (`ExportImportSection.tsx`): the file field no longer triggers the import automatically on file selection, a separate "Import Data" button (disabled until a file is chosen) triggers the import. **General UI polish** based on direct visual feedback (no new Nara screenshots): segmented control (`.segmented-control`, a single pill container) for Sex (Boy/Girl) on `AddChildPage`/`ChildPage`/`CreateFamilyPage` instead of two separate pill buttons; Export/Import Data on the Child screen styled as settings links (`.settings-action`, bold, no button background) rather than large filled buttons.
> 8. **Growth screen (`GrowthDetailPage.tsx`) revised** (2026-09-23) based on direct feedback from the user (no new Nara screenshots): the **chart view now shows only the chart** — the "callout" card that used to systematically appear below a clicked point (date, value, percentile, age, source, Edit/Dismiss buttons) has been removed; editing a measurement is now done from the list view only. The **list view** (top-right icon) now shows each entry across 3 stacked lines (`{Metric} {value}` / `{Sex} Percentile {value}% ›` / `Age {value}`) instead of a single compact line — the chevron linking to edit stays on the percentile line only, not on the whole row.
> 9. **Activity screen overhaul + child photo** (2026-09-25), based on real Nara screenshots (Activity, Summary sheet, Child photo menu). **Activity**: cards reordered Feed, Diaper, Sleep, Medication, Growth; serif band title with the round "+" straddling the band's bottom edge; big illustrated icon (line icon over a category-colored blob, shared `BlobIcon`, icons redrawn: tilted bottle, moon + star, diaper, pill bottle, scale, ruler, head tape) + "Last feeding / 2h 02m ago" + big serif value on the right (`180 mL`, diaper `pee`/`poo`/`mix`/`dry`). Recent entries sit behind a **Show More / Show Less** toggle (remembered per card in `localStorage`) and cover **since yesterday at the start of the baby's night** (`activityWindowStart`, e.g. 20:00), then an "Entries before 20:00 ›" link to History; "View History ›" when nothing is recent. Rows: `16:01 Bottle` over a proportional bar + value; yesterday's rows prefixed `YD`; times now 24-hour everywhere. Growth rows show the measurement date. **Edit Activities** pill button at the bottom → the existing Edit Activities screen. **Header "…"** (Activity screen only) opens the **Summary** sheet: Today / Last 24 Hours, one row per category with a count badge and totals (`buildActivitySummary`; sleeps count only their part inside the range), hidden categories left out. The notes (list icon) button from Nara is not added (no notes in v1). **Child photo**: tapping the round photo on the Child screen opens "Change Child Photo" (Choose From Library / Take Photo / Delete Photo); the picked image opens a **Move and Scale** crop (drag, pinch, slider or wheel to zoom, circular preview), saved as a 320×320 JPEG data URL on `Baby.photoDataUrl` (≈20–40 KB on the Firestore doc — no Cloud Storage bucket or rules needed), and shown in the header next to the name.
> 10. **Routine card, 24-hour pickers, Nara-style durations** (2026-09-25). **Routine** replaces the Medication card on Activity (after Sleep, lavender `--category-routine`): two always-visible rows, **Bath** and **Vitamin D**, each with how long ago it last happened (a dose counts as vitamin when its name starts with "Vitamin", so Nara's "Vitamin/Probiotic" too); tapping a row logs a new one. "+" opens "Add to Routine" (Bath / Vitamin D / Other medication). Show More lists baths and doses since last night; "Set reminder" stays. **Baths** are a new `bathEntries` collection (time + notes, `BathForm`), shown in History (daily list, week marks, "Bath" filter), the Summary sheet and the CSV export/import; the Nara import now keeps `Bath` routines instead of skipping them. Edit Activities' "Medication" toggle becomes "Routine (bath, vitamin)". **24-hour time everywhere**: native `datetime-local`/`time` inputs (shown in AM/PM on phones set to English) replaced by a date input + hour/minute selects (`DateTimeField`, `TimeSelect`). **Relative times** now read like Nara: "2h 2m ago", "204 days ago".

## 0. Prerequisites before starting (Windows machine) — step by step

✅ Already done: VS Code, Claude Code, Git for Windows.

Still to do, **in this order**:

### 1. Check/configure Git
Open a terminal (PowerShell):
```
git config --global user.name "Your name"
git config --global user.email "your-email@example.com"
```
Needed once — without it, commits have no author.

### 2. Node.js LTS
Download and run the `.msi` installer from https://nodejs.org (the "LTS" button). Default install (Next, Next...). Check in a **new** terminal:
```
node -v
npm -v
```

### 3. Java (JDK), any version ≥ 11
Download the Windows `.msi` installer from https://adoptium.net (Temurin). During installation, leave the default options checked ("Add to PATH", "Set JAVA_HOME"). Check:
```
java -version
```
Needed for the Firestore emulator (section 4b), not just for Node.

### 4. GitHub account + private repo
1. Create an account at https://github.com (if not already done).
2. "New repository" → name `baby-tracker` → **Private** → Create (no README or .gitignore for now).
3. In a terminal, on this PC:
```
git clone https://github.com/<your-user>/baby-tracker.git
cd baby-tracker
```
4. Copy the contents of this `plan.md` (this one) into a new `plan.md` file at the root of the cloned folder (create the file in VS Code, copy-paste the text from the Mac).
5. Then:
```
git add plan.md
git commit -m "Add implementation plan"
git push
```
On the first `push`, a browser window opens to sign in to GitHub (Git Credential Manager, bundled with Git for Windows) — sign in there, nothing to configure by hand.

### 5. Google account + Firebase project
1. https://console.firebase.google.com, sign in with a Google account.
2. "Add project" → name it `baby-tracker` (Google Analytics: decline, not needed here).
3. In the project: **Build → Firestore Database → Create database** menu → production mode → pick a nearby region (e.g. `europe-west`).
4. **Build → Authentication → Get started** menu → enable the "Email/Password" method. *(History: since replaced by Google Sign-In, see section 1b — going forward, enable "Google" here instead.)*
5. In a terminal:
```
npm install -g firebase-tools
firebase login
```
(opens the browser, sign in with the same Google account). Don't run `firebase init` yet — that happens in Phase 1, once the Vite project folder exists.

**Credit card: not needed yet.** The free "Spark" plan is enough to get started (Firestore, Auth, Hosting, FCM). The paid "Blaze" plan (card required, real cost ≈ €0/month at this usage) will only be needed in Phase 5 (Medication & reminder, section 8) — plan a budget alert at €0/€1 at that point.

### 6. Vercel account
1. https://vercel.com/signup → **"Continue with GitHub"** (recommended: links the two accounts directly).
2. Authorize access to the `baby-tracker` repo (you can restrict to "Only select repositories").
3. Nothing else to do now — the Vercel project import happens in Phase 1/2, once there's a build to deploy.

### 7. Check Claude Code
Open a terminal, run `claude`. If not already signed in, a browser sign-in is requested — check that it's the right account for implementation.

No need for an Apple/Google Play developer account (this isn't a store app); PWA icons and FCM config are set up during implementation.

Once all this is done, hand this `plan.md` (already in the repo since step 4) to the Claude instance doing the implementation — it contains all the necessary context.

## 1. Decisions already made (do not reopen without reason)

- **Platform**: PWA (web app installable on the home screen), a single codebase for both phones. No native app.
- **Recommended stack**: React + Vite + TypeScript, service worker for installability, offline support, and push notifications.
- **Backend/sync**: **Firebase** (Firestore + Authentication + Cloud Functions + Cloud Messaging/FCM). Chosen after an explicit comparison with Supabase — a deliberate trade-off:
  - **For Firebase**: offline persistence built into the web SDK (`enableIndexedDbPersistence`/`persistentLocalCache`, no local queue to hand-code) and push (FCM) more turnkey than homegrown Web Push.
  - **Against Firebase, accepted as a trade-off**: no server-side `GROUP BY`/aggregation (averages/stats computed in client-side JS — no perf concern at this scale: 2 users); the scheduled medication reminder (section 8) requires the paid "Blaze" plan (credit card, real cost ~€0); future migration/self-hosting is heavier than "just Postgres".
- **Hosting**: **Vercel** for now (see section 0, point 7).
- **Auth**: see section 1b — **Google Sign-In with an account shared by both parents**, replaces the email/password sign-in method initially implemented. Authorization still relies on `memberUids` (unchanged), with an email allowlist as an extra layer. Still minimal: no public signup, no generalized multi-household management.
- **Repo**: `~/project/baby-tracker` (created, empty for now).

## 1b. Authentication — Google Sign-In (code implemented on 2026-09-23, carried over from Corentin's PR #2, manual deployment still pending)

**Context**: the version initially implemented (Phase 1, section 10) used Firebase Auth email/password + a `memberUids` field on the household, checked in the Security Rules. Decision changed afterward, to avoid any password screen (an invitation mechanism via Anonymous Auth was also considered then dropped — it avoids the password but the UID is tied to the device, so it's lost on every phone change/reinstall, requiring re-pairing via a link). Two implementations were written in parallel (one in this repo, the other in Corentin's [PR #2](https://github.com/cpeuvrel/baby-tracker/pull/2) on `cpeuvrel/baby-tracker`, the repo's new origin) — **the PR #2 version was chosen and adopted as-is**, described below. It differs from the first attempt on two structural points (see the comparison at the end of this section).

**Decision adopted (implemented in code)**:
- **A single shared Google account** for both parents (`amandineandcorentin@gmail.com`), not an individual account per parent — both phones sign in with the same Google credentials. This choice avoids touching the existing household/`memberUids` logic: there's still only ever one possible uid, so `households.ts` (`subscribeToHouseholdForUser(uid, ...)`, filtered by `memberUids array-contains uid`) and `HouseholdContext.tsx` **did not change**.
- **Sign-in method**: Firebase Authentication, **Google** provider only (`signInWithPopup` + a module-level `GoogleAuthProvider` instance in `AuthContext.tsx`; `signInWithRedirect`, chosen initially for mobile reliability, turned out to be broken both locally **and** in prod — see note 5 at the top of the document). `LoginPage.tsx` now has just a "Sign in with Google" button; the error state (`error`) now lives in `AuthContext` (exposed via `useAuth()`) rather than locally in `LoginPage`, since an error can also come from the auth listener itself (see next point), not just from the click. The rejection message names the rejected account (e.g. "x@gmail.com is not authorized.") to immediately distinguish a wrong Google account from an actual connection issue.
- **`getRedirectResult(auth)` called on mount** (in the same `useEffect` as `onAuthStateChanged`) to catch errors from the Google redirect (e.g. unauthorized domain) and show "Unable to sign in with Google." instead of failing silently.
- **Allowlist checked both client-side AND server-side**:
  - Client (`AuthContext.tsx`): `ALLOWED_EMAILS = ['amandineandcorentin@gmail.com']`; in the `onAuthStateChanged` listener, if the signed-in account's email isn't on it, immediate sign-out (`signOut`) + a message naming the rejected account (e.g. "x@gmail.com is not authorized.") — prevents some arbitrary Google account from staying "signed in" in the UI while only failing later on Firestore reads.
  - Server (`firestore.rules`): new `isAllowedEmail()` function (same list, hardcoded) **added on top of** the existing `memberUids` check (`isHouseholdMember`), not replacing it — both conditions are required (`isAllowedEmail() && uid in memberUids`).
```
function isAllowedEmail() {
  return request.auth != null &&
    request.auth.token.email in ['amandineandcorentin@gmail.com'];
}

function isHouseholdMember(householdId) {
  return isAllowedEmail() &&
    request.auth.uid in
      get(/databases/$(database)/documents/households/$(householdId)).data.memberUids;
}
```
  The email is hardcoded in the code, version-controlled, deployed via `firebase deploy --only firestore:rules` — consistent with "no speculative generality" (section 12).

**Differences from the first attempt (not adopted)**: that one targeted two individual Google accounts (one per parent) with a two-email allowlist, and entirely replaced `memberUids` with the email as the authorization mechanism (`households.ts` simplified to `subscribeToHousehold()` with no filter, `scripts/seed-emulator.mjs` simplified). It had no client-side allowlist check (signing in with an unauthorized account failed silently on Firestore reads, with no clear message) nor any `getRedirectResult()` handling. Dropped in favor of PR #2's shared-account approach, closer to the existing code (smaller diff, `memberUids` remains the source of truth for authorization).

**Manual steps remaining before a real deployment** (the app is already in prod with real data, follow this order so nothing breaks during the switch):
1. ⬜ Firebase Console → Authentication → Sign-in method → enable "Google" **in addition to** Email/Password for now (don't disable the old one yet).
2. ⬜ Deploy this new frontend code (Vercel), **and only after that** deploy the new `firestore.rules` — never the other way around.
3. Sign in once with the shared Google account on both phones and check access to existing data.
4. Cleanup (not urgent, once access is confirmed stable): disable Email/Password in the Console, delete the old accounts under Authentication → Users.

## 2. Requested features (confirmed by the user)

1. **Import/export** of data, including **importing existing data from Nara** once retrieved (see section 9 — action required on the user's side, no known export button in Nara).
2. **Feeding tracking**: quick entry (time + quantity/type), **no timer** — see section 3 for bottle/solid detail.
3. **Sleep tracking** with a timer (like Nara), with a permanently displayed timer while tracking is active — a persistent banner/popup showing elapsed time. Pattern found very useful in Nara, to be reproduced (UX details in section 6). This is the only entry type with an "in progress" state (sleep; see section 3 for why feeding doesn't have one).
4. **Chart visualization**: curves, **averages and aggregations** of the data (e.g. average sleep duration per day/week, number and volume of bottles per day). Details in section 7.
5. **Sync** between both parents' phones, in near real time (if one parent starts a timer, the other should see it immediately).
6. **Medication tracking** (e.g. vitamin D) **with a reminder/alert** if today's dose hasn't been logged. Details in section 8.
7. **Multiple babies** in the same household (e.g. several children) — baby selector in the app, every screen/chart filtered on the selected baby.
8. **Growth curves** (weight/height) — see sections 4 and 7.
9. **Diaper tracking** (wet/dirty/both/dry) — see section 4. Vocabulary `wet`/`dirty`/`both`/`dry` (not `pee`/`poop`), aligned with the 4 actual states observed in the Nara export rather than an initial 3-state assumption. Entry buttons shown in English (Wet/Dirty/Both/Dry, like the navigation tabs in section 6.3) rather than in French.

## 3. Feeding: entry mode (resolved)

The scope (feeding, sleep, visualization, medication, multi-baby, growth) is confirmed. Breastfeeding and pumping are explicitly **out of scope** (no per-breast timer, no pumping tracking) — only bottle and solids are tracked on the feeding side.

**Bottle and solid are instant entries, not timers** — unlike sleep (start/stop timer, section 6.4):
- No "Start" button that leaves an "in progress" document in the background: the form opens already filled with the current time (editable), you fill in the rest, tap "Save" and you're done.
- No persistent banner or notification for these two types (section 6.9 is only about sleep, and later medication).
- Rationale: this is Nara's actual behavior — on its home screen, the "Feed" card shows a static amount ("6oz"), never a running counter; the only meal timer on Nara's side is the breastfeeding one, explicitly out of scope here (see above). It's also consistent with the rest of the data model: `diaperEntries` and `medicationEntries` (section 4) are already instant entries, `feedingEntries` should follow the same pattern rather than being a special case.
- If a bottle timer turns out to be genuinely useful after all (measuring how long a bottle feed takes), say so before coding phase 2 (section 10) — otherwise, instant entry for both types.

**Fields per type** (both share a single entry screen — a numeric or text field depending on the selected type, not two nearly identical forms):
- Common: `occurredAt` (time of the feed, editable, defaults to now).
- Bottle: `volumeMl` (number, optional — no forced value, some feeds don't have a precise measurement), `notes` (optional).
- Solid: `foodType` (short free text, optional — no closed food list in v1), `notes` (optional).

**Pregnancy/postpartum tracking, vaccines, milestones, general medical module are out of scope for v1** (see section 11) — Nara offers them but the user didn't ask for them.

## 4. Data model (Firestore)

Firestore is document-oriented NoSQL — no tables/joins. Suggested structure, in subcollections per baby:

```
households/{householdId}
  name
  memberUids: [uid1]         -- always the basis of authorization (section 1b); a single uid in practice since moving to a shared Google account, but the field stays an array

households/{householdId}/babies/{babyId}
  name, birthDate, sex: "male" | "female" | null   -- sex required to show WHO percentile curves (section 7)
  nighttimeHours: { start: "HH:mm", end: "HH:mm" } | null   -- night range for the nighttime wake-up calculation (section 7/6.8), defaults to 20:00–08:00 if absent

households/{householdId}/babies/{babyId}/feedingEntries/{entryId}
  type: "bottle" | "solid"
  occurredAt                           -- instant entry (section 3), no timer
  volumeMl (nullable, relevant if bottle)
  foodType (nullable, relevant if solid)
  notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/sleepEntries/{entryId}
  startedAt, endedAt, durationSeconds
  notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/diaperEntries/{entryId}
  type: "wet" | "dirty" | "both" | "dry"   -- 4 real Nara states (not 3); "dry" = diaper checked/changed with nothing in it
  occurredAt, notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/growthEntries/{entryId}
  measuredAt
  weightG, heightMm, headCircumferenceMm (all nullable)
  notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/medicationEntries/{entryId}
  name,                                -- e.g. "Vitamin D"
  givenAt, dose, notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/reminders/{reminderId}
  medicationName, timeOfDay, active

users/{uid}/fcmTokens/{tokenId}
  token, createdAt                     -- one per installed device, for sending FCM
```

- **Security Rules**: deny-by-default at the top of the file, then allow read/write only if `request.auth.uid` is in `households/{householdId}.memberUids` **and** the token's email (`request.auth.token.email`) is in the file's hardcoded allowlist (see section 1b — both conditions are required, the email allowlist is added on top of `memberUids` rather than replacing it).
- The **timer** (sleep only, section 6.4) = a document created with `startedAt` filled in and `endedAt = null` ("in progress"). Stopping fills in `endedAt` and computes `durationSeconds`. Feeding (section 3), diapers and medication never have this "in progress" state: `occurredAt`/`givenAt` is filled in directly on creation.

## 4b. Dev workflow (local first, like IntelliJ + local DB → AWS)

- **In dev**: `npm run dev` (Vite) + **Firebase Local Emulator Suite** (`firebase emulators:start` — Firestore, Auth, Functions simulated locally, with a web UI to inspect the data, the equivalent of pgAdmin). No calls to real cloud Firebase during ongoing dev, no risk to real data, the logic of the scheduled Cloud Function (section 8) is testable via the emulator without moving to the Blaze plan.
- **In "prod"** (here, the only real environment — no separate staging, 2 users): `firebase deploy` (Security Rules + Functions) and `git push` → auto Vercel deploy of the frontend.
- Limitation: push notifications and offline behavior under real conditions can only be verified after deployment (real HTTPS on a phone) — the emulator doesn't simulate this part.

## 5. Offline & real-time sync

Tracking often happens without a good connection (nighttime, bedroom). With Firebase:
- **Offline almost for free**: enable the Firestore web SDK's persistent local cache (`persistentLocalCache` / `enableIndexedDbPersistence`) — writes and reads work offline, automatic sync when the network returns. No queue to hand-code.
- Conflicts: last write wins (sufficient for 2 users, no advanced resolution to build).
- **Real-time sync**: `onSnapshot()` on "in progress" documents propagates the state (active timer) to the other phone as soon as the connection allows.

## 6. UX & reference design (Nara app) — to reproduce, do not re-research

**Top priority constraint (explicit request)**: this app's UX must match Nara Baby & Mom Tracker's — it's the app the user already uses every day, the goal is not to break her habits. This section was written after direct inspection of the official screenshots (App Store id1444639029 + nara.com, research done on 2026-09-22): **everything useful is already described below, don't redo this research** (colors = eyeballed visual estimates, not design values pulled from a source file — refine them freely, what matters is structure and feel, not pixel-perfect accuracy).

### 6.1 Palette & typography
- General background: warm ivory/cream (`#F7F1E4` approx.).
- Primary text/titles/icons: deep navy blue (`#1F3A5C` approx.).
- Main action button (e.g. "Stop Timer"): coral orange (`#F2703B` approx.), pill shape.
- Accent color per category (banner at the top of each card, reused in timelines):
  - Feeding (bottle) → yellow/amber (`#F0C14B` approx.)
  - Sleep → light blue (`#AFD0EA` approx.)
  - Growth → soft green (`#B7D98F` approx.)
  - Medication → lavender (`#C7C0E6` approx.) — Nara has a "Health" band in this color with a thermometer icon, directly reusable for section 8.
  - Diapers → no confirmed Nara color in the inspected screenshots; pick a pastel not used elsewhere (e.g. powder pink) to avoid any collision.
- Typeface: serif font (e.g. Georgia/Lora) for screen titles and the baby's name ("Nara ⌵", "Family", "Growth"); system sans-serif for regular list text.
- Very rounded corners everywhere (cards, buttons, pills), soft shadows, lots of white space.
- **Dark theme (confirmed on real screenshots, replaces any earlier assumption)**: the per-category accent colors above **do not change** between light and dark theme — only the page background/text/borders switch (cream background `#F7F1E4`→deep navy `#1E2233`, navy text→off-white, no "elevated" card surface distinct from the background in dark mode, shadows removed).

### 6.2 Home screen ("Activity")
- Header: round illustrated baby avatar + their name + small ⌵ chevron (tap = multi-baby selector, 6.7) + today's date, on the left; two pill buttons on the right (notes, "…").
- One stacked card per category (Feeding, Sleep, Growth, Medication, Diapers). Each card = colored banner (6.1) with the category name on the left and a round "+" button (navy background, white "+") on the right to add an entry; below, the latest entry on one line (icon + label + relative time "2h 10m ago" + value if relevant + chevron) and a "Show more" link to expand recent history without changing screens.

### 6.3 Navigation
Tab bar at the bottom. Nara has 5 entries (Activity, History, Trends, Guides, Account — confirmed on a real screenshot, replaces the initial "Shop" assumption); for this app, keep 4: **Activity, History, Trends, Account** (no "Guides", no editorial content). The 4th tab is called **Account** (renamed from "Family" — see section 6.8 for its detailed content: Family is now just one of the two entries under this tab, along with Settings). Active tab in navy with a line under the icon, inactive ones in light gray.

### 6.4 Sleep timer — the most requested feature
Applies only to sleep (bottle/solid use the instant-entry form from section 3, not this modal). Tapping "+" (or the "in progress" sleep entry) opens a **fullscreen modal**:
- colored category banner at the top: "X" (close) on the left, category name centered, bold "Save" on the right.
- white body: "Total Time" centered, big live `HH:MM:SS` counter, orange pill "Stop Timer" button just below.
- then as a list: "Start Time" (editable), "End Time" ("Add" until stopped), "Notes" (free text), "Add Photo" pill button at the bottom.

**Nuance for the PWA implementation**: these screenshots show the modal *when opened*, not a banner permanently visible on top of other screens. On iOS, Nara covers this need via **Live Activities** (lock screen/Dynamic Island), unusable from a PWA. The choice already made in section 5 (persistent in-app banner + FCM notification with elapsed time) is therefore the right substitute — reuse in this banner the same info density as the modal (category icon, live counter, stop button) to stay visually consistent when reopening the full modal from the banner.

### 6.5 History — confirmed and completed on a real screenshot
Weekly calendar view at the top (7 days, current day as a solid navy pill), with an **entry-type filter at the top** (Sleep/Feeding/Diapers, toggleable buttons) that shows/hides the corresponding blocks without changing week. Each day of the week = a column with a colored block per entry positioned at its time and whose height reflects the duration (color = category, palette 6.1). **Tapping a day** → shows that day's detail below (vertical timeline, one row per entry). Previous/next week navigation (‹ month year ›).

### 6.5b Trends — screen with sub-screens, added afterward based on real examples
List of rows grouped by section (Feeding / Sleep / Diapers), each row = category icon + title + average/day over the period + delta badge (↑/↓ vs. previous period, colored by category). Period pills at the top (1d/7d/14d), **no type filter** here (unlike History). Tapping a row → dedicated sub-screen for that metric: back button, big number (period average), Calendar/Chart/Entries tabs (the calendar reuses the 6.5 rendering for a single metric), same period pills, delta legend vs. previous period at the bottom.

### 6.6 Reminder settings (pattern to reuse in section 8)
Same modal as 6.4 but with a cream background: title "Nap Reminders" (→ adapt to "[Medication] Reminder"), setting rows at the top, then a **vertical stepper-style list** — one icon per scheduled event (sun = wake, moon/zzz = nap, star = bedtime) connected by a vertical line, editable time field to the right of each row. For the medication reminder (a single time per medication), one such row is enough.

### 6.7 Multi-baby selector
The ⌵ chevron next to the baby's name in the header (6.2) opens the baby selector — pattern to reuse as-is for point 7 of section 2: not a separate screen, a simple action on the existing header.

### 6.8 "Account" screen (formerly "Family") — overhaul based on real screenshots, implemented on 2026-09-23
Screen reached from the 4th tab (**Account**, section 6.3). iOS-settings-style grouped list with only two chevron rows — the other rows on Nara's Account screen (**Subscription**, **Help**, "Share & Social") are out of scope, no paywall/support/social here:
- **Family** → Family screen (below).
- **Settings** → Settings screen (below, different from the per-baby "Settings" on the Child screen).

**Family**
- "Children" section: one row per baby (name + computed age + chevron), tap → **Child** screen (below). "Add child" link at the bottom of the section → **Add Child** screen (below). **No "Pregnancy" section** (Nara has one with "Add pregnancy" — out of scope, already excluded in section 11).
- "Caregivers" section: one row per household member (email + "Your Profile" for yourself), **no "Add caregiver" button** — a caregiver = a Firebase Auth account (email/password, section 1) added via the Firebase console, not from the app. Behavior already in place in `FamilyPage.tsx` (current "Parents" section/hint), kept as-is.

**Add Child** (`AddChildPage.tsx`, replaces the old inline form at the top of the Family page)
- Fields: First Name, Sex (Boy/Girl toggle), Birthdate. **No "Use Adjusted Age"** (Nara has it to handle prematurity; out of scope here). "Save" button in the header, back button on the left (same header pattern as the modals, section 6.4/6.6). `addBaby()` now accepts `sex` at creation time.

**Child** (`ChildPage.tsx`, tap on a baby in Family — replaces the old `SettingsSection`, which only acted on the globally selected baby)
- Fields: First Name, Sex (Boy/Girl toggle), Birthdate, Age (computed live from the form, read-only). **No "Use Adjusted Age"**.
- "Settings" section: "Edit Activities" row (chevron) → `EditActivitiesPage.tsx`, "Nighttime Hours" row (chevron + current value, e.g. "20:00 - 08:00") → `NighttimeHoursPage.tsx`. **No Metric/Imperial toggle** (absent from the Nara screenshots, removed — metric stays the only setting used, `useUnitPreference` still exists for Growth formatting elsewhere). **Edit Activities implemented and filtered (decided)**: limited to our real categories (Feeding, Sleep, Diaper Changes, Growth, Medication — no Bottle/Solid distinction, matching the 5 `CategoryCard`s on the Activity screen), not Nara's full list (Breastfeeding, Pumping, Routines, Baby Firsts, Milestones, Medical, Vaccines — all out of scope, section 11). Each checkbox shows/hides the corresponding card on the Activity screen live, `localStorage` preference (`useActivityVisibility`, like `useUnitPreference`), no separate Save button (applied immediately). **"Nighttime Hours" implemented (section 7)**: From/To screen (`<input type="time">`), default `20:00–08:00` (matching Nara) if the baby has no setting yet, stored on `Baby.nighttimeHours` and used by the nighttime wake-up calculation.
- **No "Notes & Photos" section** (no notes/photos in v1, consistent with the rest of the scope).
- **Export Data** (link/button, already specified in section 9) **+ Import Data** right next to it — the actual entry points for import/export (section 9), at the level of the baby shown on this screen. `ExportImportSection` now takes `householdId`/`baby` as props (instead of reading `selectedBaby` from context), moved from `FamilyPage.tsx` to `ChildPage.tsx`.
- **No "Stop Tracking" button (decided)**: present in Nara but left out here, no scope for deleting/archiving a baby in v1.

**Settings** (`AccountSettingsPage.tsx`, at the account level — distinct from the per-baby "Settings" on the Child screen above)
- Shows the signed-in account's info (email) and a **Log out** button. The header's "⋯" menu (`Layout.tsx`), which only contained this same button, has been removed — logout now lives only here.
- **No "Communication" section** (notification/marketing preferences on Nara's side — not relevant here, no marketing content in this app).

### 6.9 Live notification/reminder (complements 6.4)
In addition to the persistent banner (6.4), a **system notification** ("Baby has been sleeping for 14h32") via **FCM** lets you see the state without opening the app — same technical building block as the medication reminders (section 8), to build once and reuse for both uses.

### 6.10 Reference images: decision made — no images in the repo
Deliberate choice, not an oversight: no Nara screenshots copied into the repo. Reasons — (1) these are proprietary visuals (Nara App Store/marketing), to avoid even in a private personal repo; (2) a precise written description (6.1-6.8) costs far fewer tokens to read for the implementing instance than an image to be analyzed, and is enough for a personal app (no need for pixel-perfect). If any doubt remains about a specific visual detail during implementation, ask the user again rather than going to look up the screenshots online.

## 7. Charts & aggregations

- Daily "timeline" view (like Nara): sequence of feeding/sleep/diaper entries over the day (section 6.5, day detail under the weekly calendar).
- **Trends screen, final structure (see 6.5b)**: list of metrics by section (not raw stat tiles) — `Bottles`/`Total volume`/`Average volume` (Feeding), `Total sleep`/`Nighttime wake-ups` (Sleep), `Diapers` (Diapers). Each metric = average/day over the selected period (1d/7d/14d) + delta vs. the previous period of the same length, and expands into a sub-screen (calendar/chart/entry list).
  - number of nighttime wake-ups = sleep entries whose start time falls within the baby's night range (`Baby.nighttimeHours`, section 6.8 — defaults to `20:00–08:00` if not set).
  - number of diapers per day, all types combined (wet/dirty/both/dry, section 4).
- Growth curve (weight/height/head circumference): **implemented** (WHO percentile curves, `GrowthDetailPage` screen, see note at the top of the document) — 9 reference curves (2/5/10/25/50/75/90/95/98%, WHO LMS tables embedded in `src/lib/whoGrowthData.ts`) overlaid on the child's curve, clickable points with a callout (date, value, percentile, age, edit), chart/list toggle. Requires the baby's sex (section 4); if not set, a message invites completing it under Account > Family > (baby) instead of the chart. CDC not included, WHO only.
- **Aggregations computed client-side** (Firestore has no server-side `GROUP BY`): fetch the entries for the relevant period and compute averages/totals in JavaScript. No perf concern at this scale (2 users, little data).
- Suggested charting library: Recharts. **Apply the repo's `dataviz` Claude Code skill at implementation time** for colors/styling.

## 8. Medication & reminder (vitamin D)

- Manual entry of a dose (`medicationEntries`), like a feeding/sleep entry but without a timer (just a time given + optional dose).
- Reminder settings UI: reuse the modal pattern described in section 6.6 (lavender banner, one editable "reminder time" row).
- **Alert**: mechanism = **Firebase Cloud Messaging (FCM)**, the only way to notify even with the app closed/phone locked (a simple "not done yet today" banner on app open isn't enough for a real alert).
  - A **scheduled Cloud Function** (`onSchedule`, Cloud Scheduler) runs every day at the time set in `reminders.timeOfDay`. **Requires the Blaze plan** (see section 0, point 6).
  - It checks whether a `medicationEntries` exists for today for that `babyId`/`medicationName`.
  - If absent, it sends an **FCM** notification to all of the household's `fcmTokens`.
  - The PWA's service worker must handle registering the FCM token (permission request on install) and displaying the received notification — same technical building block as the sleep timer's persistent banner (section 6).

## 9. Import/export — final format: CSV (JSON dropped)

- **Button location (done, section 6.8)**: Export Data and Import Data are on the **Child** screen (`ChildPage.tsx`, per baby); `ExportImportSection` takes `householdId`/`baby` as props.
- **Export**: an in-app button → walks a baby's Firestore subcollections and dumps them into **a single CSV** client-side (no need for a Cloud Function at this data volume), `category` column as a discriminator, one row per entry across all categories mixed together. Format detailed in `docs/export-format.md`.
- **Import, in 2 UI steps**: choose the file (file input) then click a separate **"Import"** button (disabled until a file is chosen) — the import no longer starts automatically on file selection. Batch write into Firestore (always new ids, no deduplication). The import **automatically detects the format** from the header and accepts two formats:
  1. the native format above (export→import round trip);
  2. **Nara's real GDPR export** (retrieved and provided by the user on 2026-09-22, file `export_narababy_malys_20260922.csv`, 1882 lines) — `Type` column + `[Bottle Feed]`/`[Sleep]`/`[Diaper]`/`[Growth]`/`[Solid Feed]`/`[Routine]`/`[Profile]` prefixes, with unit conversion (KG/CM/OZ → g/mm/mL) and mapping to our categories (e.g. `Vitamin/Probiotic` routine → medication entry). Verified against this real file: 1864 entries imported, 18 rows skipped with no equivalent in the app (bath, profile metadata row) — see `docs/export-format.md` for the full column-by-column mapping.
- Document every format change in `docs/export-format.md` to keep export and import in sync over time.

## 10. Phasing (to handle in order)

✅ All phases 1-7 are implemented (status as of 2026-09-22, see note at the top of the document).

1. ✅ **Setup** (after Phase 0 only) — in this order: `npm create vite@latest` (React+TS scaffold) → `npm install` → `firebase init` (Firestore + Auth) → Security Rules (section 4/12) → 2-account Auth → manual creation of the household and the 2 members. *(Auth being migrated to Google Sign-In, see section 1b and entry 11 below.)*
2. ✅ **Feeding + sleep + diaper tracking** — instant-entry form (feeding section 3, diapers) + start/stop timer (sleep only, section 6.4) with a persistent "in progress" banner (section 6.9), day list/timeline, baby selector (multi-baby).
3. ✅ **Real-time sync & offline** — `onSnapshot()`, persistent Firestore cache (section 5).
4. ✅ **Charts & aggregations + growth** — daily and weekly views, client-side aggregations, simple growth curve (section 7).
5. ✅ **Medication & reminder** — entry + move to Blaze plan + scheduled Cloud Function + FCM (section 8), reusing the service worker already set up in phase 2. Manual steps remaining before real use: Blaze upgrade + VAPID key generation (see `docs/notifications-setup.md`).
6. ✅ **Import/export** — section 9 (final CSV format, revised after the initial phase — see note at the top of the document).
7. ✅ **Polish** — PWA icons/manifest, settings (baby profile, units).
8. ✅ **Post-launch UX fidelity (outside the initial phasing)** — History overhaul (weekly calendar + type filter, 6.5) and Trends (list + delta + per-metric sub-screens, 6.5b) based on real Nara screenshots; added the 4th diaper state `dry`; CSV import of the real Nara GDPR export (section 9).
9. ✅ **WHO percentile curves (outside the initial phasing, formerly noted as v1.1 extension)** — baby's sex, WHO LMS tables, `GrowthDetailPage` screen with percentile chart and list view (section 7).
10. ✅ **Account/Family/Child/Settings restructuring (outside the initial phasing, 2026-09-23)** — see section 6.8: 4th tab renamed Account, separate Family/Child/Add Child/Settings screens, Export/Import Data on the Child screen (section 9), functional Edit Activities (shows/hides Activity cards, `useActivityVisibility`), Nighttime Hours implemented (point 7 below). No "Stop Tracking" (decided, out of scope for v1).
11. 🟡 **Migration of authentication to Google Sign-In** (section 1b, carried over from Corentin's PR #2) — **code done** (2026-09-23); manual deployment remains (4 steps listed in 1b: enable Google in the Console, deploy frontend then rules in that order, sign in with the shared account, cleanup of the old Email/Password).
12. ✅ **"Create Family" onboarding (outside the initial phasing, 2026-09-23)** — welcome screen to create the household + first child on first sign-in, instead of a blank screen. See note at the top of the document.

## 11. Out of scope for v1 (explicitly)

- Breastfeeding and pumping — explicitly removed from the feeding scope.
- Pregnancy, postpartum, vaccines, milestones, general medical module — offered by Nara, not requested.
- CDC growth percentile curves (WHO only implemented, see section 7 and the note at the top of the document).
- Multi-household beyond the 2 parents (nanny, grandparents, etc.).
- Advanced sync conflict resolution — last write wins is enough for 2 users.
- Self-hosting the database — Firestore isn't exportable "like Postgres", accepted as a trade-off (section 1).

## 12. Best practices to follow during implementation

**Code — quality**
- One responsibility per function/component/hook: a dedicated `useSleepTimer()` rather than a screen component that handles state, sync, and rendering.
- Names that reveal intent (`startFeedingTimer`, not `handleClick2`); no comment to make up for a bad name.
- No comments explaining *what* — only *why*, when it's non-obvious (a hidden constraint, a workaround for a bug).
- Dead code removed immediately, never commented out "just in case" (git keeps the history).
- No speculative generality: no abstraction layer for "what if we add a 3rd parent/backend someday" — it's 2 users, 1-2 babies, period.
- Guard clauses / early returns rather than nested conditions.
- Named constants for magic values (`SLEEP_REMINDER_HOUR`, not a hardcoded `8`).

**Tests — real code coverage**
- Aim for meaningful coverage (~80%) both on business logic (timer duration calculation, aggregations/averages, growth percentile if implemented) and on key UI flows (start/stop a timer, enter an entry, sync).
- Configure the threshold in the test tool (`vitest --coverage`, `thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }` in `vitest.config.ts`) so it's checked automatically, not just aimed for from memory.
- Coverage must come from tests that verify real behavior, not tests written just to bump the number up (no test calling a function with no meaningful assertion).
- Component tests using accessible queries (`getByRole`) rather than `data-testid` — they survive markup refactors.

**Data security (Firestore)**
- Deny-by-default Security Rules, then explicitly allow read/write only if `request.auth.uid` is in `households/{id}.memberUids` **and** the token's email (`request.auth.token.email`) is in `firestore.rules`'s hardcoded allowlist (section 1b) — never leave the rules in "test mode" (everything allowed) after the initial setup.
- Never rely solely on client-side checks: Firestore is called directly from the app, so filtering by household must be enforced by the server-side rules.

**Accessibility (low cost, to do from the start)**
- Every interactive element (timer start/stop button, timeline entry) = a real `<button>`/semantic tag with a visible label, never a styled `<div onClick>`.
- Every form field has an associated `<label>`, not just a placeholder.
- Live states (timer running, syncing) use `aria-live` so they're announced, not just visual.

**Debugging**
- Root cause before fix: reproduce the bug, read the actual error message/stack, understand the cause before changing code — no random fixes.
- After ~3 unsuccessful fixes on the same issue, stop and question the approach rather than stacking on a 4th patch.

**Verification before saying "it's done"**
- Never claim a feature "works" without actually having run it (build, tests, or manual check on the Vercel deployment) — no "it should work".
- Before checking off a plan phase as done, go through its points one by one against what was actually built.

**Git — lightweight (2-person project, not a company)**
- One branch per plan phase/feature, branching from `main`, small commits.
- No mandatory reviewer, but review your own diff like a stranger would before merging.
- No CI pipeline to build: Vercel's automatic per-branch previews are already enough of a "does it build" safety net.
