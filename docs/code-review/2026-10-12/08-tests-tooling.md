# 08 — Revue transversale : suite de tests, outillage, dette technique

Périmètre : `vitest.config.ts`, `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `.github/**`, `package.json` (racine + `functions/`), `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `src/test/*`, l'ensemble des `*.test.ts(x)` (échantillon lu en entier : `useRecentEntries`, `appTime`, `useElapsedSeconds`, `useNow`, `HouseholdContext`, `App`, `sleepEntries`, `messaging`, `firestoreBatch`, `SleepTimerModal`, `ChildPage`, `HistoryPage` (début), `TabBar`, `Layout`, `pushRegistration`, `useActiveSleepEntry`, `vaccineNotification`, `babies` (début), `ActivityPage` (début), `Pediatrician` (début/fin), `functions/src/*.test.ts`), et les sources sans test listées dans la mission.

Outils lancés (`node_modules/` présent) :
- `npx tsc -b --noEmit` → OK (0 erreur). `npx tsc --noEmit -p functions/tsconfig.json` → OK. Type-check de `functions/src/*.test.ts` (hors tsconfig) → OK aussi.
- `npx oxlint` → **0 erreur, 26 warnings** : 13 × `react(purity)` (`new Date()`/`Date.now()` pendant le rendu), 11 × `react(set-state-in-effect)`, 2 × `react(only-export-components)`. Exit code 0 → la CI passe.
- `npx vitest run --coverage` → **86 fichiers, 587 tests, tous verts, 77,7 s** (jsdom créé 86 fois = 53 % du temps). Couverture globale : 90,4 % statements / 82,5 % branches / 87,0 % fonctions / 92,2 % lignes. 68 fichiers sur 123 à 100 % de lignes. Fichiers < 75 % : `src/lib/foregroundPush.ts` (9 %), `src/lib/photoExport.ts` (22 %), `src/pages/PediatricianVisitPage.tsx` (59 %).
- Probe TS : `strict` est bien actif dans `tsconfig.app.json` (défaut TypeScript 7, vérifié : `TS7006 implicit any` remonte). `--noUncheckedIndexedAccess` produirait 212 erreurs.
- Probe TS de `src/sw.ts` avec `lib: ["ES2023","WebWorker"]` : **1 seule erreur** (`src/lib/sleepTimerNotification.ts:42` `Notification.requestPermission` absent du lib WebWorker).

---

### [TEST-01] Aucun test des règles Firestore, alors qu'elles portent toute la sécurité et le verrou « un seul sommeil à la fois »
- **Sévérité** : Haute
- **Catégorie** : tests
- **Fichier(s)** : `firestore.rules:1-83`, `package.json:9-19` (scripts), `.github/workflows/ci.yml:11-38`, `functions/package.json:20` (`firebase-tools` déjà présent)
- **Constat** : `firestore.rules` contient de la logique non triviale : allowlist e-mail (`isAllowedEmail`, l.6-9), appartenance via `get()` (l.11-15), wildcard `{entryCollection}/{entryId}` avec exclusion `sleepEntries`/`locks` (l.32-36), verrou `locks/sleepTimer` avec `getAfter()` côté `sleepEntries` (l.38-47) et `isFree()` via `exists()`/`get()` côté lock (l.49-64). Aucun test ne l'exerce : `@firebase/rules-unit-testing` est absent des deux `package-lock.json` (grep = 0), aucun répertoire de tests de règles, aucun job CI avec émulateur. Les tests front (`src/repositories/sleepEntries.test.ts:89-94`) ne font que simuler un `permission-denied` renvoyé par un mock. Le commentaire de `src/lib/sleepAlreadyRunning.ts:1` affirme que « firestore.rules refused it » — l'affirmation n'est vérifiée nulle part.
- **Impact** : une modification de règle (ou une régression du SDK) qui laisse passer un non-membre, qui bloque un parent légitime, ou qui casse le verrou (deux sommeils en cours → notifications et agrégats faux) n'est détectée qu'en production, par les utilisateurs. Le verrou a été introduit au dernier commit (`d417488 Sleep timer: only one sleep can run at a time`) sans filet.
- **Solution proposée** :
  1. `npm i -D @firebase/rules-unit-testing firebase-tools` (racine) — ou réutiliser `functions/node_modules/.bin/firebase`.
  2. Créer `rules/firestore.rules.test.ts` + `vitest.rules.config.ts` (`environment: 'node'`, `include: ['rules/**/*.test.ts']`, `fileParallelism: false`).
  3. Script `package.json` : `"test:rules": "firebase emulators:exec --only firestore --project demo-baby-tracker \"vitest run --config vitest.rules.config.ts\""`.
  4. Squelette :
     ```ts
     const env = await initializeTestEnvironment({ projectId: 'demo-baby-tracker',
       firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
     const parent = env.authenticatedContext('uid1', { email: 'amandineandcorentin@gmail.com' }).firestore()
     const stranger = env.authenticatedContext('uid2', { email: 'x@gmail.com' }).firestore()
     const notMember = env.authenticatedContext('uid3', { email: 'amandineandcorentin@gmail.com' }).firestore()
     beforeEach(() => env.clearFirestore().then(() => env.withSecurityRulesDisabled(c =>
       setDoc(doc(c.firestore(), 'households/h1'), { name: 'F', memberUids: ['uid1'] }))))
     ```
  5. Scénarios à couvrir (assertSucceeds/assertFails) :
     - membre allowlisté : read/update `households/h1`, read/write `babies/b1`, read/write `babies/b1/feedingEntries/x` → OK ;
     - `stranger` (e-mail hors allowlist, même si on l'ajoute à `memberUids`) → tout refusé ; `notMember` (e-mail OK, uid absent) → tout refusé ;
     - `create households/h2` avec `memberUids` ne contenant pas son uid → refusé ;
     - `users/uid1/fcmTokens/t` par uid1 → OK ; par uid3 → refusé ; `users/uid1` (doc parent) → refusé (catch-all l.80-82) ;
     - **verrou** : (a) `setDoc(sleepEntries/s1, {endedAt:null,...})` seul → refusé ; (b) `writeBatch` {s1 running + `locks/sleepTimer {entryId:'s1'}`} → OK ; (c) batch {s2 running + lock `{entryId:'s2'}`} alors que s1 court → refusé ; (d) `updateDoc(s1, {endedAt: now})` sans lock → OK, puis (c) → OK ; (e) `deleteDoc(s1)` en cours puis lock vers s2 → OK (`!exists`) ; (f) `updateDoc(s1,{notes:'x'})` sur un sommeil en cours (pas `startsRunning`) → OK sans lock ; (g) écriture directe `locks/sleepTimer` via le wildcard → refusée (l.35) ;
     - wildcard : `babies/b1/whateverCollection/x` est **autorisé** (l.32-36) — l'asserter explicitement et décider si l'on restreint à une liste (`entryCollection in ['feedingEntries','diaperEntries','bathEntries','growthEntries','medicationEntries','reminders','pediatricianVisits']`).
  6. CI : job `rules` dans `ci.yml` (`actions/setup-java@v4` non nécessaire, Java est préinstallé sur `ubuntu-latest`) : `npm ci` → `npm run test:rules`. Dépendre de ce job dans `dependabot.needs`.
- **Complexité du fix** : L
- **Confiance** : Haute

### [TEST-02] `firestore.indexes.json` est vide alors que `checkMedicationReminders` fait une requête égalité + plage sur deux champs ; rien dans l'outillage ne le détecte
- **Sévérité** : Haute
- **Catégorie** : robustesse
- **Fichier(s)** : `firestore.indexes.json:1-4`, `functions/src/index.ts:33-38`, `firebase.json:2-5`, `.github/workflows/deploy-functions.yml:31`
- **Constat** : `functions/src/index.ts:33-38` enchaîne `.where('name','==',medicationName).where('givenAt','>=',…)` : égalité sur un champ + inégalité sur un autre, ce qui exige un index composite Firestore (`medicationEntries`: `name ASC, givenAt ASC`). `firestore.indexes.json` ne déclare aucun index (`"indexes": []`) alors que `firebase.json:4` le désigne comme source de vérité. Les autres requêtes (front : plage sur un seul champ + `orderBy` même champ ; functions : `endedAt == null`, `date >= / <=` même champ) n'en ont pas besoin. Aucun test n'exécute cette requête (index.test.ts ne teste que `isWithinCheckWindow`/`startOfParisDay`), et le job de déploiement ne fait qu'`--only functions`.
- **Impact** : soit l'index n'existe pas → `checkMedicationReminders` échoue toutes les 15 min avec `FAILED_PRECONDITION` dès qu'un rappel actif existe (aucun rappel vitamine D jamais envoyé, erreur visible seulement dans les logs GCP) ; soit il a été créé à la main dans la console → un futur `firebase deploy` complet (non `--only functions`) proposera de **supprimer** cet index absent du fichier (en `--non-interactive`, échec du déploiement). Dans les deux cas, le fichier versionné ment.
- **Solution proposée** : (1) déclarer l'index dans `firestore.indexes.json` : `{"collectionGroup":"medicationEntries","queryScope":"COLLECTION","fields":[{"fieldPath":"name","order":"ASCENDING"},{"fieldPath":"givenAt","order":"ASCENDING"}]}` et déployer `firebase deploy --only firestore:indexes` (ou ajouter `firestore` au job deploy). (2) Alternative sans index : lire `givenAt >= startOfDay` seul et filtrer `name` en mémoire (quelques docs/jour). (3) Test : dans le job `rules`/émulateur de TEST-01, un test d'intégration lançant la requête contre l'émulateur Firestore avec `firestore.indexes.json` chargé (l'émulateur ne refuse pas les index manquants par défaut ; utile surtout comme documentation exécutable) — ou, plus simple, un test unitaire qui parse `firestore.indexes.json` et vérifie la présence de l'entrée `medicationEntries(name, givenAt)`.
- **Complexité du fix** : S
- **Confiance** : Moyenne (impossible de vérifier depuis le repo si l'index existe dans la console ; le besoin d'index pour ce type de requête est certain)

### [TEST-03] `Layout.test.tsx` initialise le vrai SDK Firestore et ouvre un listener gRPC vers `127.0.0.1:8080` — aucune garde n'empêche un test unitaire de toucher Firebase
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : `src/components/Layout.test.tsx:39-48`, `src/components/Layout.tsx:6,68`, `src/components/ActiveTimersBanner.tsx:15`, `src/lib/firebase.ts:22-31`, `src/test/setup.ts`
- **Constat** : la sortie `stderr` de la suite (run verbose) montre, pendant `Layout > opens the Summary…` : `@firebase/firestore: GrpcConnection RPC 'Listen' stream … error. Code: 14 UNAVAILABLE … connect ECONNREFUSED 127.0.0.1:8080` et `Error using user provided cache. Falling back to memory cache`. Cause : `Layout.test.tsx` spie `useHousehold` et `useEntriesInRange` mais `Layout` rend `ActiveTimersBanner` (l.68) qui appelle le vrai `useActiveSleepEntries` → `subscribeToActiveSleeps` → `onSnapshot` sur le vrai `db` de `src/lib/firebase.ts` (initialisé avec le dummy config de `vitest.config.ts` et `connectFirestoreEmulator`). Le test passe uniquement parce que le SDK bascule en mode hors-ligne. Rien dans `src/test/setup.ts` n'interdit ce chemin ; `firebase.ts` est à 100 % de couverture lignes, preuve qu'il est réellement exécuté par la suite.
- **Impact** : test lent (324 ms vs ~20 ms pour les voisins), bruyant, dépendant du réseau local (un émulateur Firestore qui tourne sur la machine du dev pendant `vitest --watch` ferait lire de vraies données et changerait le rendu) ; toute nouvelle page qui oublie un mock se comportera pareil sans qu'aucun test n'échoue.
- **Solution proposée** : (1) dans `Layout.test.tsx`, ajouter `vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntries').mockReturnValue([])` (comme `ActivityPage.test.tsx:104-105`) ou `vi.mock('./ActiveTimersBanner')`. (2) Garde globale dans `src/test/setup.ts` pour échouer bruyamment :
  ```ts
  vi.mock('../lib/firebase', () => {
    const trap = (name: string) => new Proxy({}, { get() { throw new Error(`${name} reached from a unit test: mock the repository or hook`) } })
    return { app: trap('app'), auth: trap('auth'), db: trap('db'), usingEmulators: false }
  })
  ```
  Les tests qui mockent déjà `./lib/firebase` (`App.test.tsx:10`, `messaging.test.ts:10`) gardent la priorité (mock local > setup). Vérifier ensuite que la suite reste verte et corriger les tests qui tombent dans le piège. (3) Option complémentaire : `vitest.config.ts` → `test.onConsoleLog` ou un `afterEach` qui échoue si `console.error` a reçu un message `@firebase/firestore`.
- **Complexité du fix** : S (Layout) / M (garde globale + corrections)
- **Confiance** : Haute

### [TEST-04] La CI ne bloque pas sur les warnings oxlint (26 aujourd'hui) et des règles clés ne sont pas activées
- **Sévérité** : Moyenne
- **Catégorie** : maintenabilité
- **Fichier(s)** : `.oxlintrc.json:1-8`, `package.json:14` (`"lint": "oxlint"`), `.github/workflows/ci.yml:21`
- **Constat** : `oxlint` sort en code 0 avec 26 warnings ; `npm run lint` en CI est donc décoratif. Les warnings ne sont pas anodins : 11 × `react(set-state-in-effect)` (`useRecentEntries.ts:21`, `useEntriesInRange.ts:33`, `HouseholdContext.tsx:38`, `useReminder.ts:14`, `useActiveSleepEntry.ts:14`, `useGrowthEntries.ts:10`, `useElapsedSeconds.ts:9`, `SleepTimerModal.tsx:36`, `ReminderSettingsModal.tsx:30`, `PhotoCropModal.tsx:33`, `ChildPage.tsx:26`) et 13 × `react(purity)` (`new Date()` pendant le rendu : `Layout.tsx:54`, `TrendsPage.tsx:29`, `FamilyPage.tsx:9`, `WeekTimelineChart.tsx:45,69,104`, `TimelineGrid.tsx:122`, `MetricCalendar.tsx:70`, `MetricGraph.tsx:64`, `DailyTimeline.tsx:54`, `GrowthDetailPage.tsx:80`, `ChildPage.tsx:108`, `SleepEntryEditModal.tsx:41`). La config n'active que `react/rules-of-hooks` et `react/only-export-components` : pas de `react/exhaustive-deps` (le projet repose massivement sur des `useEffect` de souscription), pas de plugin `vitest` (`--vitest-plugin` existe : `no-focused-tests`, `no-disabled-tests`, `no-identical-title`, `expect-expect`, `valid-expect`), pas de plugin `import` (`no-cycle`, `no-duplicates`), pas de `jsx-a11y`.
- **Impact** : les warnings s'accumulent sans signal (ils sont passés de 0 à 26 sans que la CI bronche) ; un `it.only` oublié ferait passer en CI un fichier dont 90 % des tests sont désactivés ; un `useEffect` avec dépendance manquante (souscription Firestore non renouvelée au changement de bébé) ne serait pas signalé.
- **Solution proposée** : (1) `package.json` : `"lint": "oxlint --deny-warnings"` après triage des 26 warnings (les `purity` se corrigent en passant `now` via `useNow()`/props ou en déplaçant `new Date()` dans un `useMemo` sur une dépendance de temps ; les `set-state-in-effect` liés à un reset synchrone (`setEntries([])` quand `householdId` est null) peuvent être réécrits en « dériver pendant le rendu » ou marqués `// oxlint-disable-next-line react/set-state-in-effect` avec justification). (2) `.oxlintrc.json` :
  ```json
  { "plugins": ["react", "typescript", "oxc", "import", "vitest", "jsx-a11y"],
    "rules": { "react/rules-of-hooks": "error", "react/exhaustive-deps": "warn",
      "react/only-export-components": ["warn", { "allowConstantExport": true }],
      "vitest/no-focused-tests": "error", "vitest/no-disabled-tests": "warn",
      "vitest/no-identical-title": "error", "vitest/expect-expect": "warn",
      "import/no-cycle": "error", "import/no-duplicates": "warn" },
    "overrides": [{ "files": ["**/*.test.ts", "**/*.test.tsx", "src/test/**"], "rules": { "react/only-export-components": "off" } }] }
  ```
  (3) Vérifier le nom exact de la règle hooks dans `node_modules/oxlint/configuration_schema.json` (`react/exhaustive-deps`) — `oxlint --rules` n'a rien imprimé dans cet environnement.
- **Complexité du fix** : M
- **Confiance** : Haute (constat) / Moyenne (noms exacts des règles oxlint)

### [TEST-05] Seuils de couverture déclarés mais jamais appliqués : la CI n'exécute pas `--coverage`
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : `vitest.config.ts:27-38`, `.github/workflows/ci.yml:22`, `package.json:17-18`
- **Constat** : `vitest.config.ts` définit `thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }` mais la CI lance `npm test` = `vitest run` (sans `--coverage`) ; seul `test:coverage` (jamais appelé) les évaluerait. Les seuils sont globaux : avec 90 % global, un fichier à 9 % (`foregroundPush.ts`) ou 22 % (`photoExport.ts`) passe. `src/sw.ts` est exclu de la couverture (l.31) — légitime — mais aussi de tout type-check (voir TEST-07).
- **Impact** : une PR qui supprime la moitié des tests ou ajoute 500 lignes non testées passe la CI ; l'auteur croit à tort qu'un filet de 80 % existe.
- **Solution proposée** : `ci.yml` job `app` : remplacer `npm test` par `npm run test:coverage` (coût mesuré : +~10 s) et publier `coverage/` en artefact (`actions/upload-artifact@v4`, `if: always()`). Dans `vitest.config.ts`, ajouter `reporter: ['text-summary', 'html', 'json-summary']` et `thresholds.perFile: true` avec des seuils par fichier plus bas (`lines: 60`) pour attraper les trous individuels sans bloquer sur les branches ; ou lister explicitement les fichiers volontairement non couverts dans `exclude` avec un commentaire (`photoExport.ts` dépend de canvas, voir TEST-10).
- **Complexité du fix** : S
- **Confiance** : Haute

### [TEST-06] Les handlers Cloud Functions (schedulers, triggers, envoi push, nettoyage des tokens) n'ont aucun test — seules les fonctions pures le sont
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : `functions/src/index.ts:59-92`, `functions/src/sleepTimer.ts:36-86`, `functions/src/vaccineReminders.ts:96-135`, `functions/src/push.ts:14-34`, `functions/src/tokens.ts:9-19`
- **Constat** : `index.test.ts`, `sleepTimer.test.ts`, `vaccineReminders.test.ts` ne testent que `isWithinCheckWindow`, `startOfParisDay`, `sleepChange`, `needsPurchaseQuestion`, `needsDayReminder`, `addDays`, `parisDateValue`, `purchaseQuestionSettled`. Non testés : la boucle households → babies → reminders (`index.ts:65-90`), `hasMedicationToday` (requête de TEST-02), `tickSleepTimerNotifications` (`sleepTimer.ts:52-66`), `onSleepEntryWritten` dont la navigation `before.ref.parent.parent!.parent.parent!` (l.80), `sendToHousehold` et surtout la suppression des tokens `messaging/registration-token-not-registered` (`push.ts:29-33`), `collectHouseholdTokens` (`tokens.ts`). `push.ts` est mocké dans 3 tests, jamais testé. `functions/src/index.ts:13-16` (`minutesSinceMidnight`) renvoie `NaN` pour un `timeOfDay` mal formé → `isWithinCheckWindow` renvoie `false` silencieusement : non testé non plus.
- **Impact** : une erreur de chemin (`parent.parent!`) ou un `tokens[index]` désaligné (`push.ts:31` suppose que `response.responses` est dans l'ordre de `tokens`) supprimerait de mauvais tokens ou planterait la fonction à chaque minute, détecté seulement via les logs GCP.
- **Solution proposée** : (1) Extraire l'orchestration en fonctions pures injectées : `export async function runMedicationReminders(db: Firestore, now: Date, send: (householdRef, name) => Promise<void>)` et tester avec un faux `db` minimal (ou l'émulateur Firestore via `firebase emulators:exec` déjà proposé en TEST-01, avec `firebase-admin` pointant `FIRESTORE_EMULATOR_HOST`). (2) `push.ts` : test avec `vi.mock('firebase-admin/messaging')` renvoyant `{ responses: [{success:true},{success:false,error:{code:'messaging/registration-token-not-registered'}}] }` et asserter que seul `tokens[1].ref.delete` est appelé ; cas `tokens.length === 0` ; cas erreur d'un autre code (pas de suppression). (3) `tokens.ts` : household sans `memberUids` → `[]`. (4) `sleepTimer.ts` : factoriser `householdRefOf(entryRef)` et le tester sur un chemin `households/h/babies/b/sleepEntries/s`. (5) Ajouter un test `isWithinCheckWindow('9h00', …)` → documenter/valider le format (`/^\d{2}:\d{2}$/`) à l'écriture dans `src/repositories/reminders.ts`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [TEST-07] `src/sw.ts` n'est ni typé, ni linté utilement, ni testé ; il importe `workbox-core` non déclaré et duplique la config Firebase en dur
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/sw.ts:1-9,34-41`, `tsconfig.app.json:28`, `package.json:36-37`, `vitest.config.ts:31`
- **Constat** : `tsconfig.app.json` exclut `src/sw.ts` (commentaire l.2-6 du fichier : « DOM and WebWorker have incompatible types »). Mon essai avec un tsconfig dédié (`lib: ["ES2023","WebWorker"]`, `types: []`) ne produit **qu'une seule erreur** : `src/lib/sleepTimerNotification.ts:42` (`Notification.requestPermission` n'existe pas dans un worker) — l'incompatibilité annoncée est donc marginale. `sw.ts:9` importe `workbox-core` qui n'est pas dans `package.json` (seul `workbox-precaching` l'est ; `workbox-core` n'est disponible que par hoisting transitif). `sw.ts:34-41` recopie en dur `apiKey`, `projectId`, `messagingSenderId`, `appId` alors que le reste de l'app les lit depuis `VITE_*` : en mode émulateur le SW parle quand même au projet prod. Aucun test ne couvre le routage des pushes (`onBackgroundMessage`, l.45-79) ni `notificationclick` (l.86-103), alors que la logique de tag/actions est réelle.
- **Impact** : une faute de frappe dans `sw.ts` n'est vue qu'au `vite build` (esbuild ne type-check pas), c'est-à-dire après que tests et lint sont passés ; un bump de `workbox-precaching` qui cesserait de dépendre de `workbox-core` casse le build (Dependabot auto-merge, voir TEST-12) ; une rotation des clés Firebase oblige à penser à deux endroits.
- **Solution proposée** : (1) `npm i -D workbox-core@7.4.1` (même version que `workbox-precaching`). (2) Créer `tsconfig.sw.json` (`extends: ./tsconfig.app.json`, `lib: ["ES2023","WebWorker"]`, `types: []`, `include: ["src/sw.ts"]`, `exclude: []`), l'ajouter aux `references` de `tsconfig.json` pour que `tsc -b` le vérifie en CI ; corriger la seule erreur en déplaçant `requestSleepTimerNotificationPermission` (`sleepTimerNotification.ts:33-45`) vers un module DOM-only (ex. `src/lib/notificationPermission.ts`) — le SW n'en a pas besoin. (3) Extraire le routage des pushes en fonction pure testable : `export function handleBackgroundMessage(data, registration, now)` dans `src/lib/pushRouting.ts` (importée par `sw.ts`), avec tests : sleep-timer → `showNotification(SLEEP_TIMER_TITLE, …)`, stop → `getNotifications({tag}).forEach(close)`, vaccine, fallback `notification.title`. (4) Lire la config via `import.meta.env.VITE_FIREBASE_*` (vite-plugin-pwa `injectManifest` passe par esbuild et remplace `import.meta.env` — à vérifier avec `define`/`injectManifest.envDir`), ou au minimum un commentaire + test qui compare `sw.ts` et `.env.example`.
- **Complexité du fix** : M
- **Confiance** : Haute (probe tsc réalisée) / Moyenne pour le point (4)

### [TEST-08] Les tests de repositories n'assertent jamais les contraintes de requête (`where`/`orderBy`/`limit`)
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : `src/repositories/*.test.ts` (ex. `sleepEntries.test.ts:260-284`, `feedingEntries.test.ts`, `diaperEntries.test.ts`, `bathEntries.test.ts`, `medicationEntries.test.ts`, `growthEntries.test.ts`, `pediatricianVisits.test.ts`, `households.test.ts`), `src/repositories/sleepEntries.ts:43,75-80`
- **Constat** : les 11 repositories construisent 25 requêtes avec `where`/`orderBy`/`limit` ; `grep -cE 'limit\(|orderBy\(|where\('` sur `src/repositories/*.test.ts` = **0**. Tous les tests capturent `onSnapshotMock.mockImplementation((_query, callback) => …)` et ignorent `_query`. Par exemple « maps the most recent sleep entries regardless of date range » (`sleepEntries.test.ts:260-284`) passerait si `limit(count)` ou `orderBy('startedAt','desc')` disparaissaient, ou si la plage `[start, end)` devenait `[start, end]`. Le mock de `firebase/firestore` utilise pourtant `importActual` (bonne idée : `collection`/`query` sont réels et les chemins sont vérifiés via `ref.path`), donc l'objet `Query` reçu est authentique et comparable.
- **Impact** : une inversion de tri (`asc`/`desc`), un `limit` oublié (lecture de toute l'historique à chaque ouverture d'Activity → coût Firestore et latence) ou un bord de plage faux (entrée à minuit comptée deux jours) passent les tests ; ce sont précisément les bugs typiques d'un repository.
- **Solution proposée** : utiliser l'API publique `queryEqual` du SDK dans chaque test de souscription/lecture :
  ```ts
  import { limit, orderBy, query, queryEqual, where } from 'firebase/firestore'
  const [received] = onSnapshotMock.mock.calls[0]
  expect(queryEqual(received as Query, query(sleepEntriesCollection('h1','b1'), orderBy('startedAt','desc'), limit(5)))).toBe(true)
  ```
  Ajouter un helper `expectQuery(received, expected)` dans `src/test/` qui affiche `(received as any)._query` en cas d'échec. Couvrir en priorité : `subscribeToRecent*` (orderBy desc + limit), `subscribeTo*InRange` (bornes `>=`/`<` + orderBy), `subscribeToActiveSleeps` (`endedAt == null`), `subscribeToHouseholdForUser` (`array-contains`), `getAll*` (orderBy). Même approche pour `getDocsMock`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [TEST-09] Les tests de `functions/` ne sont jamais type-checkés et tournent sans configuration Vitest (TZ non épinglée)
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : `functions/tsconfig.json:15` (`"exclude": ["src/**/*.test.ts"]`), `functions/package.json:12` (`vitest run --dir src`), `.github/workflows/ci.yml:36-37`
- **Constat** : `functions/tsconfig.json` exclut les tests (nécessaire pour ne pas les émettre dans `lib/`), et Vitest ne type-check pas : les `*.test.ts` de `functions/` ne sont vérifiés par personne (contrairement au front où `tsc -b` inclut `src/**`). Aujourd'hui ils compilent (vérifié avec un tsc ad hoc, 0 erreur) mais rien ne le garantit demain : `sleepTimer.test.ts:4-6` fabrique des `{ toDate }` qui n'ont que la forme de `Timestamp` ; un changement de signature de `sleepChange` ne serait vu qu'à l'exécution. Il n'y a pas de `functions/vitest.config.ts` : pas de `TZ` fixé (le front le fait dans `vitest.config.ts:7`), pas de `include` explicite, pas de couverture.
- **Impact** : une PR qui change un type dans `functions/src` sans adapter un test obtient une erreur d'exécution cryptique plutôt qu'une erreur de type ; un test qui s'appuierait sur `new Date(y, m, d)` (heure locale) passerait sur une machine Paris et échouerait en CI (UTC) ou l'inverse.
- **Solution proposée** : (1) `functions/tsconfig.test.json` : `{ "extends": "./tsconfig.json", "compilerOptions": { "noEmit": true, "rootDir": "src" }, "include": ["src"], "exclude": [] }` ; script `"typecheck": "tsc -p tsconfig.test.json"` ; `ci.yml` job `functions` : ajouter `- run: npm run typecheck`. (2) `functions/vitest.config.ts` : `process.env.TZ = 'America/New_York'` (même convention que la racine) + `test: { include: ['src/**/*.test.ts'], environment: 'node', coverage: { include: ['src/**'] } }` et simplifier le script en `vitest run`. (3) Lint : ajouter `cd functions && npx oxlint` ou laisser le `oxlint` racine (qui couvre déjà `functions/src`, vérifié : 0 warning).
- **Complexité du fix** : S
- **Confiance** : Haute

### [TEST-10] Cartographie des trous de couverture à risque (fichiers sans test ou chemins critiques non exercés)
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : voir liste
- **Constat** : la couverture est bonne (92 % lignes) et la plupart des fichiers « sans `.test` » listés dans la mission sont en réalité couverts indirectement (`useCurrentVisit.ts` 100 %, `usePediatricianVisits.ts` 100 % lignes, `useRecent*Entries.ts` 100 % via `useRecentEntries.test.ts` et `ActivityPage.test.tsx`, pages `Pediatrician*`/`VisitDiscussion`/`VisitRemarks` via `Pediatrician.test.tsx`, `historyFilters.ts`/`upcomingVisits.ts`/`visitItems.ts`/`sleepAlreadyRunning.ts`/`paths.ts` 100 %). Les vrais trous, par priorité :
  1. `src/lib/foregroundPush.ts` (9 % lignes, l.17-28) : routage des pushes reçus au premier plan (fermeture de la question vaccin, affichage via `registration.showNotification`) — **risqué** (seule voie de notification vaccin quand l'app est ouverte) ; à tester avec `vi.mock('firebase/messaging', { isSupported, getMessaging, onMessage })` en capturant le callback et en stubbant `navigator.serviceWorker.ready`.
  2. `src/pages/PediatricianVisitPage.tsx` (59 %) : `setDate` (l.48-51, garde `date === ''`), `handleDelete` + `navigate(replace)` (l.53-57), `setVaccinated(true)` → `requestSleepTimerNotificationPermission().then(registerPush)` (l.34-41), `Navigate` quand `visit === null` (l.29) — **risqué** (suppression de données, permission).
  3. `src/components/Layout.tsx:23-31` : navigation sur message `{type:'navigate', url}` du SW, y compris le rejet des URL non relatives (`startsWith('/')`) — **risqué** (sécurité : ouverture d'URL arbitraire) ; à tester en stubbant `navigator.serviceWorker` et en dispatchant un `MessageEvent`.
  4. `src/repositories/medicationEntries.ts:33-48` `subscribeToMedicationEntriesInRange` : seul `*InRange` non testé alors que ses jumeaux le sont (bornes de plage).
  5. `src/contexts/AuthContext.tsx:64-69` (erreur du listener `onAuthStateChanged` → sortie du « Loading… ») et `HouseholdContext.tsx:55-57,71-73` (erreurs de souscription → `error`, `loading=false`) : chemins « l'app ne reste pas bloquée sur Loading » non testés.
  6. `src/hooks/useSleepTimerNotification.ts` (fonctions 55 %) : le `setTimeout(CLOSE_DELAY_MS)` qui ferme la notification et son `clearTimeout` au retour d'un sommeil — un test `vi.useFakeTimers` + `renderHook` avec `activeEntry` null → non-null avant 3 s doit vérifier que `closeSleepTimerNotification` n'est **pas** appelé.
  7. `src/lib/photoExport.ts` (22 %) : dépend de `canvas.getContext('2d')` absent de jsdom — soit l'exclure explicitement de la couverture avec commentaire, soit tester avec un stub `HTMLCanvasElement.prototype.getContext` (vérifier `drawImage(image, x, y, size, size, 0, 0, 320, 320)` et `toDataURL('image/jpeg', 0.85)`).
  8. `src/pages/TrendDetailPage.tsx:272-303,319-324` : vue « entries » et ouverture des modales d'édition depuis la liste (3 branches par type) — moyen.
  9. `src/components/NewVisitModal.tsx` (55 % fonctions), `VisitItemEditorModal.tsx` (78 %), `PhotoCropModal.tsx` (gestes pinch/wheel l.60-120) — bas.
  10. `src/lib/whoGrowthData.ts` : données ; `src/components/icons.tsx` : SVG ; `BlobIcon`, `EmptyState`, `TrendMetricIcon`, `DurationInput`, `DateTimeField`, `EntryRowItem`, `TimelineGrid`, `TodayRecap`, `MetricGraph` : couverts à 80-100 % via leurs parents — RAS.
- **Impact** : les trous 1-3 touchent des comportements de sécurité/notification impossibles à vérifier à la main sans deux téléphones ; 4-6 sont des chemins d'erreur qui, s'ils régressent, figent l'app sur « Loading… ».
- **Solution proposée** : ajouter, dans l'ordre ci-dessus, `src/lib/foregroundPush.test.ts`, 4 cas dans `Pediatrician.test.tsx` (date vide ignorée, date changée → `updatePediatricianVisit(…, {date})`, suppression confirmée → `deletePediatricianVisit` + redirection vers `/account/pediatrician/history`, visite inconnue → redirection `/account/pediatrician`), 2 cas dans `Layout.test.tsx` (message `navigate` relatif → `navigate` appelé ; `https://evil` → ignoré), 1 cas dans `medicationEntries.test.ts`, 1 cas d'erreur dans `AuthContext.test.tsx` et `HouseholdContext.test.tsx`, `src/hooks/useSleepTimerNotification.test.ts`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [TEST-11] Hygiène des mocks : spies `window.alert`/`window.confirm` et spies de modules jamais restaurés ; aucune option `restoreMocks`/`unstubGlobals`/`unstubEnvs`
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `vitest.config.ts:11-13`, `src/test/setup.ts:6-8`, `src/pages/ChildPage.test.tsx:148,160`, `src/components/SleepTimerModal.test.tsx:248`, `src/components/ExportImportSection.test.tsx`, `src/components/{Bath,Diaper,Feeding,Growth,Medication}Form.test.tsx`, `src/components/SleepEntryEditModal.test.tsx`, `src/pages/ActivityPage.test.tsx`
- **Constat** : 10 fichiers font `vi.spyOn(window, 'confirm'|'alert')` sans `mockRestore()` ni `vi.restoreAllMocks()` (seuls `pushRegistration.test.ts`, `Pediatrician.test.tsx`, `sleepTimerNotification.test.ts`, `messaging.test.ts` restaurent quelque chose). Idem pour `vi.spyOn(HouseholdContext, 'useHousehold')`, `vi.spyOn(useActiveSleepEntryModule, …)` : réécrasés à chaque `beforeEach` mais jamais restaurés. `messaging.test.ts:17-38` restaure `globalThis.Notification` et `navigator.serviceWorker` à la main. L'isolation par fichier (`isolate: true` par défaut) limite les dégâts à l'intérieur d'un fichier : dans `ChildPage.test.tsx`, le test « deletes the child » laisse `confirm → true` ; si un test ultérieur du même fichier cliquait « Delete Child » sans re-spier, il supprimerait sans le vouloir.
- **Impact** : fuites intra-fichier silencieuses, ordre des tests significatif, et tout passage à `isolate: false` (proposé par Vitest pour accélérer la suite, cf. TEST-18) deviendrait impossible.
- **Solution proposée** : `vitest.config.ts` → `test: { restoreMocks: true, unstubGlobals: true, unstubEnvs: true, … }`. Depuis Vitest 3, `restoreMocks` ne restaure que les spies `vi.spyOn` et ne touche pas aux `vi.fn()` (les `const startSleep = vi.fn().mockResolvedValue()` au niveau module restent intacts) — lancer la suite après activation et corriger les rares tests qui dépendaient d'un spy posé dans un test précédent. Retirer alors les restaurations manuelles de `messaging.test.ts` au profit de `vi.stubGlobal('Notification', …)`.
- **Complexité du fix** : S
- **Confiance** : Moyenne (sémantique exacte de `restoreMocks` en Vitest 5 à confirmer sur la doc ; comportement connu depuis v3)

### [TEST-12] Dependabot fusionne automatiquement les minors/patchs de `firebase*`, `react`, `vite` alors que la suite ne touche jamais le vrai SDK
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `.github/dependabot.yml:25-27,41-43`, `.github/workflows/ci.yml:40-78`
- **Constat** : les groupes `app-minor-patch`/`functions-minor-patch` englobent tout, et `ci.yml:70-72` merge dès que lint/tests/build passent. Or tous les tests mockent `firebase/firestore`, `firebase/auth`, `firebase/messaging`, `firebase-admin/*` (cf. `vi.mock` : 12 × `firebase/firestore`, aucun test d'intégration) : un minor de `firebase` (12.x → 12.y) qui change le comportement de `persistentMultipleTabManager`, de `connectFirestoreEmulator` ou du format des erreurs `permission-denied` (sur lequel `src/lib/sleepAlreadyRunning.ts` repose) passerait la CI et irait en prod (déploiement Vercel sur `main`) sans qu'un humain regarde. Même chose pour `firebase-functions` 7.x côté runtime (déployé automatiquement par `ci.yml:75-78`).
- **Impact** : régression en production un lundi matin 6h (heure planifiée) sans revue ; difficile à relier à la cause (aucune PR « humaine »).
- **Solution proposée** : (1) `dependabot.yml` : sortir les dépendances runtime sensibles du groupe auto-mergé : `groups: { app-minor-patch: { update-types: [minor, patch], exclude-patterns: ["firebase", "react", "react-dom", "react-router-dom", "vite", "vite-plugin-pwa"] } }` (et `firebase-admin`, `firebase-functions` côté functions) — elles arrivent alors en PR séparées, et l'étape `Merge` de `ci.yml` doit les ignorer : ajouter `&& !contains(steps.meta.outputs.dependency-names, 'firebase')` (ou tester `steps.meta.outputs.dependency-group` pour ne merger que les groupes). (2) À terme, le job émulateur de TEST-01 (règles) + un smoke test front contre l'émulateur (`VITE_USE_FIREBASE_EMULATORS=true`, login par mot de passe via `scripts/seed-emulator.mjs`) donnerait un vrai signal sur les bumps du SDK.
- **Complexité du fix** : S
- **Confiance** : Haute

### [TEST-13] Duplication structurelle : 5 repositories d'entrées quasi identiques, 5 hooks `useRecent*Entries` identiques, et leurs tests ×6
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/repositories/{bath,diaper,feeding,medication,growth}Entries.ts` (114-140 lignes chacun), `src/hooks/useRecent{Bath,Diaper,Feeding,Medication,Sleep}Entries.ts` (11 lignes chacun), `src/repositories/*.test.ts` (~1 000 lignes au total)
- **Constat** : `diff <(sed s/diaper/X/ diaperEntries.ts) <(sed s/bath/X/ bathEntries.ts)` ne montre que 5 lignes de différence (le champ `type`). Chaque repository répète `toXEntry`, `subscribeToXEntriesInRange`, `subscribeToRecentXEntries`, `getAllXEntries`, `importXEntries`, `logX`, `updateX`, `deleteX`, et chaque test les re-teste. Les 5 hooks `useRecent*` ne font qu'appliquer `useRecentEntries` à une fonction importée. Conséquence concrète déjà visible : `subscribeToMedicationEntriesInRange` est le seul `*InRange` sans test (TEST-10 #4) — la duplication fait diverger la couverture ; et toute correction d'un bord de plage doit être reportée cinq fois.
- **Impact** : coût de maintenance et risque d'oubli à chaque évolution transverse (ex. ajout d'un champ `updatedAt`, changement de la stratégie `import` qui conserve ou non les ids).
- **Solution proposée** : factory générique `src/repositories/entryRepository.ts` : `createEntryRepository<T, Input>({ collectionOf: (h,b) => CollectionReference, timeField: 'occurredAt'|'givenAt'|'measuredAt', fromDoc: (id, data) => T, toDoc: (input, uid) => DocumentData })` renvoyant `{ subscribeInRange, subscribeRecent, getAll, importAll, log, update, remove }`, utilisée par les 5 modules (qui ne gardent que `fromDoc`/`toDoc` et leurs spécificités : `startedAt/endedAt` pour sleep reste à part). Un seul fichier de tests `entryRepository.test.ts` couvrant les contraintes de requête (TEST-08) une fois pour toutes ; les tests spécifiques (mapping des champs) restent par module. Les hooks `useRecent*` peuvent rester (API lisible) mais pointer vers `repo.subscribeRecent`.
- **Complexité du fix** : L
- **Confiance** : Haute

### [TEST-14] Code mort et exports « test-only » : ~20 symboles exportés sans aucun appelant en production
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/lib/entrySummary.ts` (`summarizeMedicationPrimary`), `src/lib/timeline.ts` (`nightDayKey`, `lastNDayKeys`), `src/lib/growthMetrics.ts` (`formatWeightG`, `formatLengthMm`), `src/lib/babyExport.ts` (`countEntries`, `ImportResult`), `src/lib/photoExport.ts` (`PHOTO_OUTPUT_SIZE`), `src/lib/growthPercentiles.ts` (`isWithinWhoRange`, `getLmsAt`), `src/lib/trendMetrics.ts` (`elapsedPeriodDays`, `sleepSegmentInMetric`, `isNightSleep`), `src/lib/aggregations.ts` (`computeDiaperStats`, `sumSecondsByDay`, `sumVolumeByDay`, `averageVolumeByDay`, `countFeedingSessionsByDay`, `countNightWakingsByDay`, `countDiapersByDay`, `averageOfPoints`), `src/lib/vaccineNotification.ts` (`vaccinePurchaseTag`, `vaccineVisitUrl`), `src/lib/photoCrop.ts` (`displayScale`), `src/lib/sleepTimerNotification.ts` (`sleepTimerNotificationBody`), `src/components/icons.tsx` (`UserIcon`), `src/types/models.ts` (`FcmToken`), `functions/src/vaccineReminders.ts` (`VACCINE_PURCHASE_LEAD_DAYS`)
- **Constat** : grep des exports sans référence hors fichier et hors tests (script ad hoc, vérifié à la main pour les cas cités). Deux familles : (a) des fonctions exportées **uniquement pour être testées** (les 8 agrégations de `aggregations.ts`, `isWithinWhoRange`, `getLmsAt`, `displayScale`, `sleepTimerNotificationBody`, `isNightSleep`…) — si elles sont des détails internes, les exporter fige l'API et les tests testent l'implémentation ; dans `aggregations.ts`, 6 exports sur 14 ont un appelant en prod (`DEFAULT_NIGHTTIME_HOURS`, `isDuringNight`, `startsDuringNight`, `computeSleepStats`, `computeFeedingStats`, `computeDelta`) et les 8 fonctions `*ByDay`/`computeDiaperStats`/`averageOfPoints` ne sont appelées que par `aggregations.test.ts` : du code mort entretenu par une bonne partie des 249 lignes de ce test ; (b) de vrais morts : `UserIcon`, `FcmToken`, `PHOTO_OUTPUT_SIZE` (en prod), `countEntries`, `vaccinePurchaseTag`/`vaccineVisitUrl` (si les constantes dérivées suffisent), `summarizeMedicationPrimary`.
- **Impact** : bruit à la lecture, faux sentiment de couverture (les 100 % de `aggregations.ts` ne protègent peut-être aucun écran), refactors ralentis.
- **Solution proposée** : (1) réduire `aggregations.ts` aux 6 fonctions consommées (supprimer `computeDiaperStats`, `sumSecondsByDay`, `sumVolumeByDay`, `averageVolumeByDay`, `countFeedingSessionsByDay`, `countNightWakingsByDay`, `countDiapersByDay`, `averageOfPoints` et leurs tests, ou les rendre internes si `trendMetrics.ts` en a une copie). (2) Supprimer `UserIcon`, `FcmToken`, `countEntries`, `summarizeMedicationPrimary` ; rendre `PHOTO_OUTPUT_SIZE` non exporté. (3) Automatiser : `npx knip` (ou `oxlint --import-plugin` avec `import/no-unused-modules` si disponible) en CI, avec `ignoreExportsUsedInFile` et une liste d'exceptions explicites.
- **Complexité du fix** : S à M
- **Confiance** : Moyenne (grep textuel : un symbole homonyme utilisé ailleurs fausserait la détection ; les cas (b) ont été vérifiés individuellement)

### [TEST-15] `plan.md` (53 Ko à la racine, statut daté du 2026-09-23) et `README.md` vide (« Hello »)
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `plan.md:9` (« Status (2026-09-23) »), `README.md:1-3`, `docs/export-format.md`, `docs/notifications-setup.md`
- **Constat** : `plan.md` fait 391 lignes mais 53 Ko (lignes de plusieurs centaines de mots) ; son en-tête « Status » s'arrête au 2026-09-23 et liste 10 ajouts, alors que le code contient depuis : visites pédiatre + remarques/discussions, rappels vaccin (2 schedulers + trigger), verrou de sommeil, notifications sleep-timer temps réel, auto-merge Dependabot — `plan.md` ne mentionne « pediatrician/vaccine » que 3 fois et le verrou 1 fois. La section 0 (« Prerequisites… Windows machine ») est du one-shot. Le `README.md` ne dit ni comment lancer (`npm run dev` + émulateurs + `npm run seed:emulator`), ni l'existence de `.env.example`/`dev:live`, ni où sont les docs. Le brief des revues renvoie à `plan.md` « en-tête Status » pour comprendre les intentions : il est partiellement faux.
- **Impact** : un nouvel arrivant (ou un agent) lit un plan périmé et prend des décisions sur des hypothèses dépassées (ex. « metric/imperial supprimé » alors que `useUnitPreference` est encore utilisé par 5 fichiers).
- **Solution proposée** : (1) `README.md` : 30 lignes — prérequis (Node 24, Java pour les émulateurs), `cp .env.example .env.local`, `firebase emulators:start` + `npm run seed:emulator` + `npm run dev`, `npm test`/`npm run lint`/`npm run build`, lien vers `docs/` et `plan.md`, mention du compte partagé/allowlist. (2) Déplacer `plan.md` en `docs/plan.md`, supprimer la section 0, ajouter en tête une section « État au 2026-10-12 » (5-10 lignes) ou un `docs/CHANGELOG.md` alimenté par les PR. (3) Ajouter `docs/firestore-rules.md` décrivant le verrou (actuellement expliqué seulement dans les commentaires des règles).
- **Complexité du fix** : S
- **Confiance** : Haute

### [TEST-16] Bruit `stderr` toléré dans la suite (SDK Firestore, `console.error` attendus, « No routes matched », jsdom navigation)
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `src/components/Layout.test.tsx` (gRPC, voir TEST-03), `src/contexts/AuthContext.test.tsx:116` (`[auth] signInWithPopup failed` imprimé par le code), `src/pages/NighttimeHoursPage.test.tsx` (« No routes matched location "/account/family/b1" » : la route cible de `navigate` n'est pas déclarée dans le `MemoryRouter` du test), `src/components/ExportImportSection.test.tsx` (« Not implemented: navigation to another Document » : le clic sur le `<a download>` généré fait tenter une navigation à jsdom)
- **Constat** : 4 sources de bruit systématique dans un run vert. `AuthContext.test.tsx` mocke `console.error` dans un seul test (`HouseholdContext.test.tsx:114`) mais pas pour `signInWithPopup failed`. `NighttimeHoursPage.test` navigue vers une route inexistante : le test « saves the edited range » ne vérifie donc pas la destination. `ExportImportSection.test` déclenche une vraie tentative de navigation jsdom au lieu de stubber `HTMLAnchorElement.prototype.click`.
- **Impact** : les vraies alertes (acte React non wrappé, promesse non gérée, erreur Firestore) se noient ; aujourd'hui aucune n'apparaît (vérifié : 0 « not wrapped in act »), ce qui est le bon moment pour verrouiller.
- **Solution proposée** : (1) `src/test/setup.ts` : `afterEach` qui échoue si `console.error`/`console.warn` ont été appelés sans être explicitement attendus (spy global + `expect(consoleError).not.toHaveBeenCalled()`, avec un helper `expectConsoleError(/pattern/)` pour les cas voulus). (2) `NighttimeHoursPage.test.tsx` : déclarer `<Route path="/account/family/:babyId" element={<p>Child screen</p>} />` et asserter `findByText('Child screen')`. (3) `ExportImportSection.test.tsx` : `vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})` et asserter `download`/`href`. (4) TEST-03 règle le bruit Firestore.
- **Complexité du fix** : S
- **Confiance** : Haute

### [TEST-17] `tsconfig.app.json` : `strict` implicite (défaut TS 7) et `noUncheckedIndexedAccess` absent
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `tsconfig.app.json:1-29`, `tsconfig.node.json`, `functions/tsconfig.json:8` (qui, lui, écrit `"strict": true`)
- **Constat** : `strict` n'est pas écrit dans `tsconfig.app.json` ; il est actif uniquement parce que TypeScript 7 l'a rendu par défaut (vérifié par probe). Un retour en 5.x (ou un outil tiers qui lit la config, ex. un IDE avec son propre TS) lirait `strict: false`. `noUncheckedIndexedAccess` est désactivé : 212 erreurs si on l'active d'un coup — trop pour un fix, mais des cas réels existent (`functions/src/index.ts:14` `const [hours, minutes] = hhmm.split(':').map(Number)` typé `number` alors que `minutes` peut être `undefined` ; `src/test/timeFields.ts:16,22` idem).
- **Impact** : faible aujourd'hui ; dette de configuration.
- **Solution proposée** : écrire `"strict": true` explicitement dans `tsconfig.app.json` et `tsconfig.node.json` ; activer `noUncheckedIndexedAccess` d'abord dans `functions/tsconfig.json` (petit code, 0 ou peu d'erreurs) puis, au fil de l'eau, côté app.
- **Complexité du fix** : S
- **Confiance** : Haute

### [TEST-18] Performance de la suite : jsdom instancié 86 fois (53 % des 78 s), y compris pour ~30 fichiers de `src/lib` purement algorithmiques
- **Sévérité** : Nit
- **Catégorie** : perf
- **Fichier(s)** : `vitest.config.ts:12` (`environment: 'jsdom'` global), `src/lib/*.test.ts`
- **Constat** : Vitest rapporte « jsdom was created 86 times · 106 s total, 53 % of tracked time ». Les tests de `src/lib/{appTime,aggregations,csv,duration,age,timeline,trendMetrics,growthPercentiles,…}` n'ont pas besoin de DOM.
- **Impact** : ~40 s perdues par run local et CI ; incite à ne pas lancer la suite complète.
- **Solution proposée** : soit un en-tête `// @vitest-environment node` dans les tests de `src/lib` sans DOM, soit `test.projects` dans `vitest.config.ts` (projet `lib` en `environment: 'node'` sur `src/lib/**/*.test.ts` hors `messaging`/`pushRegistration`/`photoCrop`/`sleepTimerNotification` ; projet `ui` en jsdom pour le reste). Ne pas passer à `isolate: false` tant que TEST-11 n'est pas fait.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- `vitest.config.ts:7` épingle `TZ=America/New_York` (zone différente de celle de l'app) et `src/lib/appTime.test.ts` couvre explicitement DST et bords de journée : la suite prouve l'indépendance à la timezone de la machine — exactement ce qu'il fallait.
- Les mocks `firebase/firestore` utilisent `importActual` : `collection`/`doc`/`query`/`Timestamp` sont réels, les tests vérifient des chemins Firestore réels (`ref.path`) et des payloads typés ; `fakeSnapshot` (`.docs` seulement) est fidèle à l'usage réel (aucun repository n'utilise `empty`/`size`/`docChanges` ; `reminders.ts:23` utilise `snapshot.exists()` sur un DocumentSnapshot, hors `fakeSnapshot`).
- 587 tests verts, 0 warning `act`, 0 `.only`/`.skip`, 0 `@ts-ignore`, 0 `any` hors tests, 0 TODO/FIXME ; les fake timers sont systématiquement restaurés (`try/finally` ou `afterEach`), `toFake: ['Date']` est utilisé à bon escient.
- La CI type-check les tests front via `tsc -b` (`include: ["src"]`), fait tourner lint + tests + build pour l'app et build + tests pour `functions`, et Dependabot est configuré avec cooldown 3 jours et séparation des majors.
- `Pediatrician.test.tsx`, `SleepTimerModal.test.tsx`, `ActivityPage.test.tsx` sont des tests d'intégration de page de bonne qualité (flux notification → `?baby=&vaccineBought=yes`, verrou refusé → alerte, résumé Today/24h).

## Zones non couvertes
- Je n'ai pas lu en entier les ~60 fichiers de tests non cités dans l'échantillon (revue par grep + couverture) ; les findings de qualité (TEST-08, TEST-11, TEST-16) reposent sur des grep exhaustifs mais les exemples sont tirés de l'échantillon.
- Je n'ai pas exécuté les émulateurs Firebase (interdit par le brief) : TEST-02 (existence de l'index en prod) et le comportement exact des règles n'ont pas été vérifiés dynamiquement.
- `scripts/*.mjs` (seed, autorisation de domaine preview) n'ont ni test ni type-check ; non analysés en détail (hors périmètre tests/outillage au sens strict, mais `authorize-preview-domain.mjs` exporte `nextAuthorizedDomains` qui serait facile à tester).
- Les noms exacts des règles/plugins oxlint (`react/exhaustive-deps`, plugin `vitest`) n'ont pas pu être confirmés par `oxlint --rules` (sortie vide dans cet environnement) ; `--vitest-plugin`/`--import-plugin`/`--jsx-a11y-plugin` apparaissent bien dans `oxlint --help`.
