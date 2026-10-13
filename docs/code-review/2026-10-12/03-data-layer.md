# Revue couche données — repositories Firestore, contexts, import/export

Périmètre lu en entier : `src/repositories/*.ts` (+ tests), `src/contexts/*.tsx` (+ tests), `src/lib/{firebase,paths,firestoreBatch,firestoreDates,sleepAlreadyRunning,babyExport,csv,photoExport}.ts` (+ tests, dont `babyDelete.test.ts`), `src/components/ExportImportSection.tsx` (+ test), `src/types/models.ts`, `docs/export-format.md`, `firestore.rules`, `firestore.indexes.json`. Appelants vérifiés : `SleepTimerModal`, `ActiveTimersBanner`, `SleepEntryEditModal`, `ReminderSettingsModal`, `ChildPage`, `CreateFamilyPage`, `App.tsx`, hooks `use*Entries`, `useReminder`, `useActiveSleepEntry`, `usePediatricianVisits`, `useCurrentVisit`, et côté serveur `functions/src/{index,sleepTimer,tokens}.ts`.

Aucun finding Critique ou Haute : la couche est petite, cohérente et bien testée dans l'ensemble. Les points ci-dessous sont surtout de la robustesse (import CSV, mapping défensif, démarrage hors-ligne) et quelques petits bugs.

---

### [DATA-01] Import natif : aucune validation des lignes (erreur opaque ou `NaN` stocké en base)
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/lib/babyExport.ts:176-261` (`num`, `parseNativeRows`), `src/lib/babyExport.ts:279-281` (`epochToIso`), `src/components/ExportImportSection.tsx:58,67`
- **Constat** : `parseNativeRows` ne vérifie ni la longueur de la ligne (15 colonnes attendues), ni la catégorie, ni `subtype` (`row[SUBTYPE] as FeedingType` accepte n'importe quelle chaîne, l.195/218), ni les dates (`row[AT]` relu par `new Date(...)` dans `import*Entries`), ni les nombres (`num` l.176 renvoie `Number('abc') = NaN`). Conséquences concrètes : une ligne tronquée par un tableur (colonnes vides de fin supprimées) donne `row[NOTES] === undefined` → `WriteBatch.set()` jette « Unsupported field value: undefined » ; une date invalide donne `Timestamp.fromDate(Invalid Date)` qui jette `RangeError: Invalid time value` à la sérialisation ; un `volumeMl` non numérique est **stocké** comme `NaN` (valeur valide pour Firestore) et s'affiche « NaN mL ». Le message brut de Firestore est montré à l'utilisateur (`error.message`, ExportImportSection l.67). Enfin une catégorie inconnue (`default` absent du `switch`) est ignorée en silence : `skipped` reste à 0 pour le format natif (l.482).
- **Impact** : l'utilisateur retouche son export dans Excel/Numbers (cas d'usage explicitement visé par `docs/export-format.md`) et réimporte : soit tout l'import échoue avec un message incompréhensible, soit des entrées corrompues (`NaN`, type inconnu) arrivent en base et cassent l'affichage/les agrégats. Comme les imports par collection tournent en `Promise.all`, l'échec d'une collection laisse les autres partiellement importées.
- **Solution proposée** : dans `parseNativeRows`, valider chaque ligne et jeter une erreur lisible avec le numéro de ligne (ou l'ajouter à `skipped` avec un motif) :
  ```ts
  function isoOrThrow(v: string, line: number, col: string) {
    if (Number.isNaN(new Date(v).getTime())) throw new Error(`Line ${line}: invalid ${col} "${v}"`)
    return v
  }
  function num(v: string, line: number, col: string): number | null {
    if (v === '') return null
    const n = Number(v); if (!Number.isFinite(n)) throw new Error(`Line ${line}: invalid ${col} "${v}"`)
    return n
  }
  const FEEDING_TYPES = new Set(['bottle','solid']); const DIAPER_TYPES = new Set(['wet','dirty','both','dry'])
  // au début de la boucle : if (row.length !== NATIVE_HEADER.length) throw new Error(`Line ${i+2}: expected ${NATIVE_HEADER.length} columns`)
  // default: skipped += 1  (et retourner skipped pour le natif)
  ```
  Même traitement dans `parseNaraRows` pour `epochToIso` (`Number('')` donne 0 → 1970 en silence). Tests à ajouter dans `babyExport.test.ts` : ligne courte, date invalide, `volumeMl: 'abc'`, subtype inconnu, catégorie inconnue comptée dans `skipped`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-02] BOM UTF-8 non géré : un CSV réenregistré par Excel est refusé, et l'export s'ouvre avec des accents cassés
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/lib/csv.ts:12` (`parseCsv`), `src/lib/babyExport.ts:479-487` (`parseImportFile`), `src/components/ExportImportSection.tsx:14-22` (`downloadCsvFile`)
- **Constat** : `parseCsv` ne retire pas le BOM `﻿`. Pour le format natif, `header[0]` devient `"﻿category"` et `headerEquals` échoue → « Unrecognized CSV file format. ». Pour un export Nara avec BOM, le premier caractère est hors guillemets puis la quote ouvre un champ : `header[0] === "﻿Type"` → même rejet. Excel (« CSV UTF-8 ») et plusieurs éditeurs Windows ajoutent systématiquement ce BOM. Inversement, le Blob exporté (`text/csv;charset=utf-8`, sans BOM) est interprété en ANSI par Excel Windows : « sieste côté gauche » s'affiche « sieste cÃ´tÃ© gauche », alors que le choix du CSV est justifié par l'ouverture dans un tableur.
- **Impact** : l'utilisateur ouvre son export dans Excel pour corriger une note, enregistre, réimporte → refus systématique sans explication ; ou simplement voit des accents cassés.
- **Solution proposée** : (1) `parseCsv` : `text = text.replace(/^﻿/, '')` en première ligne (ou dans `parseImportFile`). (2) `downloadCsvFile` : `new Blob(['﻿', contents], …)`. Tests : `csv.test.ts` « strips a leading BOM », `babyExport.test.ts` « accepts a native file with BOM » et round-trip export→import avec le BOM.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-03] Household : un snapshot vide venu du cache (démarrage hors-ligne) affiche l'onboarding et peut créer un second foyer, ensuite choisi arbitrairement par `limit(1)`
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/repositories/households.ts:20-34`, `src/contexts/HouseholdContext.tsx:36-60`, `src/pages/CreateFamilyPage.tsx:16-22`, `src/App.tsx:73`
- **Constat** : `subscribeToHouseholdForUser` appelle `onChange(null)` dès que `snapshot.docs[0]` est absent, sans regarder `snapshot.metadata.fromCache`. Avec `persistentLocalCache` (firebase.ts), un démarrage hors-ligne (ou avec un cache vidé et réseau indisponible) livre un premier snapshot vide `fromCache: true` → `household = null`, `loading = false` → `App.tsx` rend `CreateFamilyPage`. Si l'utilisateur soumet, `createHousehold` crée un **deuxième** document `households` (écriture mise en file, acceptée par les règles car `memberUids` contient l'uid). La requête `where('memberUids','array-contains') + limit(1)` n'a pas d'`orderBy` : l'ordre par défaut est l'id de document, donc le foyer rendu ensuite est arbitraire — potentiellement le nouveau, vide : toutes les données « disparaissent » de l'app.
- **Impact** : scénario rare mais à conséquence grave (données invisibles sans suppression réelle, aucune UI pour choisir un foyer). `plan.md` dit que l'app ne gère qu'un foyer : il faut donc empêcher d'en créer un second.
- **Solution proposée** : (a) dans `subscribeToHouseholdForUser`, ignorer les snapshots vides venant du cache : `if (snapshot.empty && snapshot.metadata.fromCache) return` (le contexte reste en `loading`, et `LoadingScreen` propose déjà la déconnexion après 8 s) ; (b) dans `createHousehold`, garde-fou côté serveur avant l'`addDoc` : `const existing = await getDocsFromServer(query(householdsCollection(), where('memberUids','array-contains', memberUid), limit(1))); if (!existing.empty) return existing.docs[0].id` ; (c) si plusieurs foyers existent malgré tout, ajouter `orderBy(documentId())` ou logguer un avertissement pour rendre le choix déterministe. Tests : `households.test.ts` avec `fakeSnapshot` enrichi d'un `metadata.fromCache` ; `HouseholdContext.test.tsx` « stays loading on an empty cached snapshot ».
- **Complexité du fix** : S
- **Confiance** : Moyenne (le comportement « snapshot vide fromCache quand hors-ligne au démarrage » est celui documenté par Firestore, non reproduit ici faute d'émulateur)

### [DATA-04] Mapping doc → modèle non défensif : un seul document mal formé fige toute la liste sans retour utilisateur
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/lib/firestoreDates.ts:3-5`, `src/repositories/sleepEntries.ts:25-35`, `src/repositories/feedingEntries.ts:21-31`, `src/repositories/diaperEntries.ts:21-29`, `src/repositories/bathEntries.ts:21-28`, `src/repositories/growthEntries.ts:26-37`, `src/repositories/medicationEntries.ts:21-31`, `src/repositories/pediatricianVisits.ts:25-36`
- **Constat** : `timestampToIso(value)` fait `value.toDate()` sans vérifier le type ; `createdAt`, `occurredAt`, `startedAt`, `givenAt`, `measuredAt` sont castés `as Timestamp` sans défaut. Un document où le champ manque ou est une chaîne (doc créé à la main dans la console, script de seed d'une autre version, import futur, champ `createdAt` absent sur un doc legacy) fait jeter `TypeError: value.toDate is not a function` **dans le callback `onSnapshot`**. Le SDK exécute ce callback dans un `setTimeout` : l'exception remonte en erreur non capturée, `onChange` n'est jamais appelé pour ce snapshot, et toutes les mises à jour suivantes de la collection sont perdues de la même façon. Les autres champs sont mieux gérés (`?? null`, `?? ''`, `?? []`), ce qui montre l'intention.
- **Impact** : la liste (Historique, Activité, Trends) reste vide ou figée pour cette catégorie, sans message, tant que le doc fautif existe — et rien dans l'app ne permet de le trouver.
- **Solution proposée** : rendre `timestampToIso` tolérant et faire sauter les docs invalides plutôt que la liste :
  ```ts
  export function timestampToIso(value: unknown): string {
    if (value instanceof Timestamp) return value.toDate().toISOString()
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
    throw new Error('Not a Firestore timestamp')
  }
  // dans chaque repository : helper partagé
  export function mapDocs<T>(snapshot, toEntry): T[] {
    const out: T[] = []
    for (const d of snapshot.docs) { try { out.push(toEntry(d.id, d.data())) } catch (e) { console.warn('[firestore] skipping malformed doc', d.ref.path, e) } }
    return out
  }
  ```
  Test : `firestoreDates.test.ts` (Date, string, undefined → throw), un test par repository « skips a doc without occurredAt instead of throwing ».
- **Complexité du fix** : M
- **Confiance** : Haute

### [DATA-05] Souscriptions des entrées sans gestionnaire d'erreur : une règle refusée ou un index manquant coupe le flux en silence
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/repositories/feedingEntries.ts:47,64`, `src/repositories/sleepEntries.ts:45,82,99`, `src/repositories/diaperEntries.ts:45,62`, `src/repositories/bathEntries.ts:44,61`, `src/repositories/growthEntries.ts:46`, `src/repositories/medicationEntries.ts:46,63`, `src/repositories/pediatricianVisits.ts:46`, `src/repositories/reminders.ts:22`
- **Constat** : seuls `households.ts` et `babies.ts` passent un `onError` (le commentaire de `households.ts` l.30-31 explique bien pourquoi). Les 13 autres `onSnapshot` n'en ont pas : en cas d'erreur (permission-denied après un changement de règles, `failed-precondition` si une requête finit par exiger un index composite, quota), le listener est **définitivement** terminé, le SDK logue une erreur console et l'UI garde les dernières données sans aucun signal.
- **Impact** : par exemple, si un jour on ajoute un `where` à `subscribeToRecentMedicationEntries` qui nécessite un index, la carte Routine affiche à vie des données périmées en prod sans qu'on le remarque (`firestore.indexes.json` est vide, rien ne protège contre cet oubli).
- **Solution proposée** : ajouter un paramètre optionnel `onError?: (e: Error) => void` à chaque `subscribeTo*` et le brancher (`(error) => { console.error('[firestore]', path, error); onError?.(error) }`) ; dans `useRecentEntries`/`useEntriesInRange`/`useActiveSleepEntries`, exposer au moins un `console.error` + éventuellement un état `error` remonté vers un toast. Tests : un test « forwards listener errors » par repository (le mock `onSnapshot` appelle le 3e argument).
- **Complexité du fix** : M
- **Confiance** : Haute

### [DATA-06] `importBabyData` compte comme « importés » les sommeils en cours que `importSleepEntries` écarte
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/babyExport.ts:548-558`, `src/repositories/sleepEntries.ts:113-125`
- **Constat** : `importSleepEntries` filtre `entries.filter(e => e.endedAt != null)` (l.115) mais `importBabyData` calcule `imported = countEntries(fresh)` (l.557) sur le tableau **avant** filtrage. Un export contenant un timer non arrêté (colonne `endAt` vide — c'est exactement ce que produit `serializeBabyExport` l.139 pendant qu'un sommeil tourne) ou un Nara `Sleep` sans `End Date/time (Epoch)` est annoncé « imported » alors qu'il n'a rien écrit. Il n'apparaît ni dans `duplicates` ni dans `skipped`.
- **Impact** : message « Import complete: 12 entries imported » pour 11 écritures réelles ; l'utilisateur ne sait pas qu'un sommeil a été ignoré.
- **Solution proposée** : faire le filtrage dans `importBabyData` (ou faire retourner par `importSleepEntries` le nombre réellement écrit) et compter les écartés : `const stoppedSleeps = fresh.sleepEntries.filter(e => e.endedAt != null); const unfinished = fresh.sleepEntries.length - stoppedSleeps.length` → `ImportResult { imported, duplicates, skippedRunning }` affiché par `ExportImportSection` (« 1 unfinished sleep ignored »). Test dans `babyExport.test.ts` « does not count a running sleep as imported ».
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-07] Suppression d'un bébé : la sous-collection `locks` n'est pas vidée (document orphelin)
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/babyExport.ts:77-85` (`deleteBabyWithData`), `src/lib/paths.ts:55-57`, `src/lib/babyDelete.test.ts:24-39`
- **Constat** : `deleteBabyWithData` vide 8 sous-collections (6 d'entrées + `reminders` + `pediatricianVisits`) puis supprime le doc bébé, mais oublie `locks/sleepTimer` écrit par `writeRunningSleep` (sleepEntries.ts l.62). Firestore conserve les sous-collections d'un doc supprimé : le lock reste pour toujours sous un bébé fantôme. Les règles l'autoriseraient à être supprimé à ce moment-là (`isFree()` est vrai puisque `sleepEntries` vient d'être vidée). Le test `babyDelete.test.ts` fige la liste des 8 collections et passerait donc à côté.
- **Impact** : fuite de données mineure (un doc par bébé supprimé), et un lecteur qui liste la base voit des chemins incohérents. Pas d'effet fonctionnel aujourd'hui.
- **Solution proposée** : ajouter `deleteDoc(sleepTimerLockDoc(householdId, babyId))` dans `deleteBabyWithData` après le vidage de `sleepEntries` (ou un `locksCollection(householdId, babyId)` dans `paths.ts` passé à `batchDeleteAll`), et ajouter `'locks'` (ou le chemin du doc) dans l'assertion de `babyDelete.test.ts`. Garder l'ordre : entrées → lock → bébé.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-08] Les visites pédiatre ne sont ni exportées ni supprimées par « Delete All Data »
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/babyExport.ts:44-56` (`exportBabyData`), `src/lib/babyExport.ts:58-71` (`deleteAllBabyData`), `docs/export-format.md`
- **Constat** : l'export CSV couvre 6 collections ; `pediatricianVisits` (date, vaccin, remarques, questions/réponses — du contenu saisi à la main, pas un réglage) n'y figure pas et la doc ne le mentionne pas (elle justifie seulement l'exclusion des `reminders`). À l'inverse, `deleteBabyWithData` les supprime bien, mais « Delete All Data » (`deleteAllBabyData`, libellé « Delete all of X's data ») les conserve. Le comportement est donc incohérent entre les deux opérations et le fichier de sauvegarde est incomplet.
- **Impact** : l'utilisateur croit avoir une sauvegarde complète avant de « Delete All Data » / réinstaller, et perd l'historique des visites (remarques du pédiatre).
- **Solution proposée** : au minimum documenter l'exclusion dans `docs/export-format.md` et dans le libellé du bouton. Mieux : ajouter une catégorie `visit` au CSV natif (colonnes `at` = `date`, `subtype` = `vaccinated|vaccinated-bought|none`, `notes` = remarques et discussions sérialisées en JSON dans la colonne `notes`), avec `getAllPediatricianVisits`/`importPediatricianVisits` dans `pediatricianVisits.ts` et clé de dédoublonnage sur `date`. Décider explicitement si `deleteAllBabyData` doit inclure `pediatricianVisitsCollection` (et le dire dans la confirmation). Tests : round-trip dans `babyExport.test.ts`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [DATA-09] Export CSV : pas de neutralisation des formules (`=`, `+`, `-`, `@`) dans les champs texte
- **Sévérité** : Basse
- **Catégorie** : sécurité
- **Fichier(s)** : `src/lib/csv.ts:1-10` (`toCsv`/`escapeField`), `src/lib/babyExport.ts:127-174`
- **Constat** : `escapeField` ne traite que `"`, `,`, CR/LF. Les champs `notes`, `dose`, `foodType`, `medicationName` sont saisis librement ; une note `=HYPERLINK("http://…";"voir")` ou `-2+3` est interprétée comme formule à l'ouverture dans Excel/LibreOffice (avertissement DDE/`cmd|' /C …'!A0` dans les anciens Excel). Le risque réel est faible (2 utilisateurs de confiance, données propres), mais le fichier est précisément fait pour être ouvert dans un tableur.
- **Impact** : une note commençant par `-` ou `+` (fréquent : « -1 dose », « +10 mL ») est transformée en formule et affichée faussement (`#NAME?` ou calculée) ; au pire, exécution d'une formule externe si quelqu'un colle du contenu malveillant dans une note.
- **Solution proposée** : dans `escapeField`, préfixer d'une apostrophe (recommandation OWASP) les champs commençant par `=`, `+`, `-`, `@`, `\t`, `\r` : `if (/^[=+\-@\t\r]/.test(field)) field = \`'${field}\``, puis la logique de quoting existante. À l'import natif, retirer cette apostrophe de tête sur les champs texte pour garantir le round-trip (`stripFormulaGuard`). Alternative moins intrusive : ne protéger que `=` et `@`. Tests `csv.test.ts` : « neutralises a leading = » et round-trip.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-10] `stopSleep` écrase un arrêt déjà enregistré depuis l'autre appareil (hors-ligne, cache persistant)
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/repositories/sleepEntries.ts:174-186`, `src/components/SleepTimerModal.tsx:53-55`, `src/components/ActiveTimersBanner.tsx:31-33`
- **Constat** : `stopSleep` fait un `updateDoc({ endedAt: now, durationSeconds })` inconditionnel. Avec `persistentLocalCache`, un appareil B hors réseau continue d'afficher le timer que A a arrêté ; si B appuie sur Stop, son écriture est mise en file et, au retour du réseau, **remplace** `endedAt`/`durationSeconds` du vrai arrêt (par exemple 30 min plus tard). Les règles n'empêchent pas cette écriture (`startsRunning()` est faux). Le démarrage est protégé par le lock, l'arrêt ne l'est pas.
- **Impact** : durée de sommeil fausse (allongée) sans que personne ne le voie ; les agrégats Trends en héritent.
- **Solution proposée** : rendre l'arrêt conditionnel. Option A (client, en ligne) : `runTransaction(db, async tx => { const snap = await tx.get(ref); if (snap.data()?.endedAt != null) return; tx.update(ref, {...}) })` — attention, une transaction échoue hors-ligne, il faut alors un fallback ou un message. Option B (règles, zéro coût réseau) : dans `match /sleepEntries/{entryId}`, refuser de poser `endedAt` si l'entrée est déjà arrêtée : `allow update: … && !(resource.data.endedAt != null && request.resource.data.endedAt != null && request.resource.data.endedAt != resource.data.endedAt && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['notes','startedAt']))` — à affiner avec l'agent règles pour laisser passer `updateSleepEntry` (édition manuelle d'une fin) : par exemple distinguer un champ `stoppedBy: 'timer'` posé par `stopSleep` seulement. Test : `sleepEntries.test.ts` « does not overwrite an already stopped sleep ».
- **Complexité du fix** : M
- **Confiance** : Moyenne (scénario hors-ligne non reproduit ; la logique de l'écriture inconditionnelle est, elle, certaine)

### [DATA-11] `downloadCsvFile` révoque l'URL du Blob immédiatement après `click()`
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/components/ExportImportSection.tsx:14-22`
- **Constat** : `URL.revokeObjectURL(url)` est appelé de façon synchrone juste après `link.click()`. Le téléchargement est asynchrone : Firefox (et parfois Safari iOS/PWA) peut ne pas avoir encore ouvert le Blob et aboutit à un fichier vide ou un échec silencieux, alors que le statut affiche « Export downloaded. ». Chrome tolère généralement le cas. Le lien n'est pas non plus attaché au DOM (`document.body.appendChild`), ce que certains WebKit exigent pour `download`.
- **Impact** : export qui « réussit » côté UI mais ne produit rien sur certains navigateurs mobiles — justement ceux de la PWA.
- **Solution proposée** : `document.body.appendChild(link); link.click(); setTimeout(() => { URL.revokeObjectURL(url); link.remove() }, 10_000)` (pattern FileSaver.js). Test : vérifier que `revokeObjectURL` n'est pas appelé synchroniquement (fake timers).
- **Complexité du fix** : S
- **Confiance** : Moyenne (comportement navigateur, non testé ici)

### [DATA-12] `docs/export-format.md` contredit le code sur le dédoublonnage et oublie les visites
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `docs/export-format.md:3-6`, `src/lib/babyExport.ts:490-517`
- **Constat** : la doc affirme « new document ids on every import — no deduplication, importing the same file repeatedly creates duplicates », alors que `importBabyData` dédoublonne depuis par clé « catégorie + minute (+ nom de médicament) » et que `ExportImportSection` affiche « N already present (ignored) ». La règle métier réelle (l'entrée de l'app gagne quelle que soit la valeur du fichier ; deux entrées de même catégorie dans la même minute sont confondues) n'est écrite qu'en commentaire du code. La doc ne mentionne pas non plus `pediatricianVisits` (voir DATA-08), ni le `skipped` natif.
- **Impact** : un futur agent/contributeur (la doc est explicitement écrite pour ça) implémente à côté ou casse le comportement attendu.
- **Solution proposée** : réécrire le paragraphe d'intro et ajouter une section « Déduplication à l'import » décrivant `timeKey` (minute UTC), la clé médicament (`name.trim().toLowerCase()`), la limite « 2 entrées de même catégorie dans la même minute = 1 », et la liste explicite des collections hors export.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-13] Allowlist e-mail dupliquée en 4 endroits, comparaison sensible à la casse
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/contexts/AuthContext.tsx:28,54`, `firestore.rules:7-8`, `src/pages/LoginPage.tsx:4`, `scripts/seed-emulator.mjs:15`
- **Constat** : l'adresse autorisée est codée en dur dans AuthContext, dans les règles Firestore, dans LoginPage (`DEV_EMAIL`) et dans le seed. Rien ne garantit leur cohérence ; un changement d'adresse (ou l'ajout d'un second compte) doit être fait à la main aux 4 endroits, et un oubli donne un comportement incohérent (connexion acceptée côté client puis `permission-denied` côté Firestore, ou l'inverse : déconnexion automatique d'un compte pourtant autorisé par les règles). La comparaison `includes(nextUser.email ?? '')` est sensible à la casse ; Google renvoie l'email en minuscules en pratique, mais rien ne le normalise.
- **Impact** : dérive silencieuse entre client et règles lors d'une future modification ; message « is not authorized » alors que la base accepterait l'écriture.
- **Solution proposée** : centraliser dans `src/lib/allowedEmails.ts` (`export const ALLOWED_EMAILS = [...]`, `isAllowedEmail(email) => ALLOWED_EMAILS.includes(email.trim().toLowerCase())`) importé par AuthContext et LoginPage ; pour les règles, générer la liste au build (script `npm run rules:sync` qui réécrit la ligne `request.auth.token.email in [...]`) ou ajouter un test Vitest qui lit `firestore.rules` et vérifie que les adresses y sont identiques à la constante. Test AuthContext : accepter `Amandineandcorentin@gmail.com`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-14] Couverture de tests : les requêtes, les docs legacy et les cas limites CSV ne sont pas vérifiés
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `src/repositories/*.test.ts`, `src/lib/csv.test.ts`, `src/lib/babyExport.test.ts`, `src/contexts/HouseholdContext.test.tsx`
- **Constat** : (1) Les tests de repositories mockent `onSnapshot`/`getDocs` et ne regardent jamais la requête passée : `subscribeToSleepEntriesInRange` passerait avec un `where` inversé, un `orderBy` manquant ou une `limit` fausse (ex. `sleepEntries.test.ts:244-276`). (2) Aucun test de mapping avec champ absent sauf `pediatricianVisits` et `babies` : `notes`, `durationSeconds`, `dose`, `foodType` manquants (docs legacy ou Nara) ne sont pas couverts, ni le cas `createdAt` absent (DATA-04). (3) `csv.test.ts` ne couvre ni le BOM, ni un `\r` seul, ni une quote au milieu d'un champ non quoté, ni un champ vide final (`a,`). (4) `babyExport.test.ts` ne couvre aucune ligne malformée (DATA-01) ni le compte des sommeils en cours (DATA-06). (5) `HouseholdContext.test.tsx` ne couvre pas : id stocké d'un bébé supprimé (repli sur `babies[0]`), passage `household` → `null` (reset des bébés), désabonnement à l'unmount/au changement d'utilisateur, chemin d'erreur, `loading` tant que les bébés n'ont pas répondu.
- **Impact** : les comportements les plus risqués (bornes temporelles, index, données legacy, offline) peuvent régresser sans qu'aucun test ne rougisse.
- **Solution proposée** : pour (1), capturer la requête (`onSnapshotMock.mock.calls[0][0]`) et asserter via `(query as any)._query` ou, plus robuste, mocker `query`/`where`/`orderBy`/`limit` pour vérifier les arguments (`expect(where).toHaveBeenCalledWith('startedAt', '>=', Timestamp.fromDate(range.start))`). Pour (2)-(4), ajouter les cas listés. Pour (5), un test avec `localStorage.setItem('baby-tracker:selectedBabyId','ghost')` et un test qui vérifie que la fonction d'unsubscribe retournée par le mock est appelée au `unmount()`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [DATA-15] Reminders : le nom du médicament sert d'id de document (latent : `/` ou chaîne vide fait jeter `doc()`)
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/repositories/reminders.ts:20,34`, `src/hooks/useReminder.ts:17`, `functions/src/index.ts:76-85`
- **Constat** : `doc(remindersCollection(...), medicationName)` jette synchroniquement si `medicationName` contient `/` (« Document references must have an even number of segments »), est vide, ou vaut `.`/`..`. Aujourd'hui le seul appelant passe la constante `'Vitamin D'` (ActivityPage l.68), donc pas de bug actif — mais l'import Nara crée des entrées nommées `Vitamin/Probiotic` (babyExport.ts l.437-441) et la Cloud Function matche les rappels sur `name == medicationName` : dès qu'on proposera un rappel par médicament existant, le `/` plantera `useReminder` dans un `useEffect` (crash de l'écran). Le serveur, lui, lit `medicationName` depuis les données du doc, pas depuis l'id.
- **Impact** : aucun aujourd'hui ; crash garanti à la première évolution « rappel pour n'importe quel médicament ».
- **Solution proposée** : dériver l'id d'un slug (`encodeURIComponent(medicationName.trim().toLowerCase())` ou `medicationName.replace(/\//g, '∕')`) dans un helper `reminderDocId(name)` utilisé par `subscribeToReminder` et `setReminder` ; le champ `medicationName` reste la source de vérité pour la fonction. Test : `setReminder('h1','b1','Vitamin/Probiotic', …)` ne jette pas et écrit `medicationName: 'Vitamin/Probiotic'`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-16] `HouseholdContext` : résabonnement aux bébés à chaque snapshot du foyer, `error` jamais effacé, `selectBaby` non mémoïsé
- **Sévérité** : Nit
- **Catégorie** : perf
- **Fichier(s)** : `src/contexts/HouseholdContext.tsx:62-76,83-91`, `src/hooks/useCurrentVisit.ts:22-24`
- **Constat** : l'effet des bébés dépend de `[household]` (objet recréé à chaque snapshot, households.ts l.35-39) : toute modification du doc foyer (renommage, ajout de membre) désabonne/réabonne `subscribeToBabies` et repasse par un état intermédiaire. `error` n'est remis à `null` qu'au changement d'utilisateur : après une erreur transitoire suivie d'un snapshot réussi, `App.tsx` continue d'afficher l'écran d'erreur. `selectBaby` est recréée à chaque rendu et figure dans les dépendances d'un `useEffect` de `useCurrentVisit`.
- **Impact** : négligeable aujourd'hui (le doc foyer ne change quasiment jamais) ; dette qui surprendra si on ajoute des champs au foyer.
- **Solution proposée** : dépendre de `household?.id` ; `setError(null)` dans les callbacks de succès ; `const selectBaby = useCallback(..., [])`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-17] AuthContext : fermeture volontaire de la popup affichée comme erreur, `logout`/`signOut` sans gestion d'erreur
- **Sévérité** : Nit
- **Catégorie** : ux
- **Fichier(s)** : `src/contexts/AuthContext.tsx:58,73-82,108-110`, `src/App.tsx:46,64`
- **Constat** : `loginWithGoogle` affiche « Unable to sign in with Google. » pour tous les codes, y compris `auth/popup-closed-by-user` et `auth/cancelled-popup-request` (l'utilisateur a simplement fermé la fenêtre). `logout` ne catch rien et est appelé en `void logout()` ; `void signOut(auth)` l.58 idem : un échec (réseau coupé au moment du sign-out) devient une unhandled rejection sans retour UI. Côté états, la logique (sign-out automatique si non allowlisté, `loading` toujours relâché, erreur du listener gérée) est correcte.
- **Impact** : message d'erreur anxiogène pour une action normale ; échecs de déconnexion invisibles.
- **Solution proposée** : dans le `catch` de `loginWithGoogle`, `if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return` ; dans `logout`, `try { await signOut(auth) } catch (cause) { setError(describeError('Unable to sign out.', cause)) }`. Tests AuthContext : « ignores a closed popup », « surfaces a sign-out failure ».
- **Complexité du fix** : S
- **Confiance** : Haute

### [DATA-18] Types de modèles trompeurs : `FcmToken.createdAt: string` alors qu'un `Timestamp` est écrit ; `FcmToken`/`Reminder.id` jamais relus
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/types/models.ts:94-98`, `src/repositories/fcmTokens.ts:5-9`, `functions/src/tokens.ts:11-15`
- **Constat** : `saveFcmToken` écrit `createdAt: Timestamp.now()` ; le type `FcmToken` annonce `createdAt: string` et n'est utilisé nulle part côté client (aucune lecture). Même chose pour `Reminder.id` qui est le nom du médicament (cf. DATA-15). Ce sont des contrats « documentaires » faux.
- **Impact** : aucun bug ; risque de confusion au moment d'ajouter une lecture (purge des vieux tokens, par exemple).
- **Solution proposée** : soit supprimer `FcmToken` du modèle client, soit l'aligner (`createdAt: Timestamp` ou commenter « Timestamp côté Firestore, converti par timestampToIso »). Ajouter un commentaire sur `Reminder.id`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- Cohérence client ↔ `firestore.rules` vérifiée écriture par écriture : `startSleep`/`resumeSleep`/`updateSleepEntry(endedAt null)` posent bien le lock dans le même batch (`getAfter`), `stopSleep`/`updateSleepStart`/`logSleep`/import de sommeils arrêtés passent `startsRunning() == false`, `createHousehold` satisfait la règle `create`, `fcmTokens` écrit sous son propre uid. Aucune écriture client que les règles rejetteraient en fonctionnement normal, ni l'inverse.
- Aucune requête n'exige d'index composite (filtres et `orderBy` sur un seul champ) : `firestore.indexes.json` vide est correct. Toutes les souscriptions sont désabonnées dans les hooks (`useRecentEntries`, `useEntriesInRange`, `useActiveSleepEntries`, `usePediatricianVisits`, contexts).
- Dates : tout est stocké en `Timestamp` et exposé en ISO UTC (`toISOString`), tri lexicographique sûr (format fixe) ; `firestoreBatch` chunke à 450 < 500 ; les champs optionnels legacy (`sex`, `nighttimeHours`, `photoDataUrl`, `vaccineBought`, `remarks`, `notes`) sont bien défaultés.
- `parseCsv` gère correctement RFC 4180 (guillemets doublés, virgules et sauts de ligne dans les champs, CRLF, ligne vide finale) ; la détection de format Nara est stricte et explicite.

## Zones non couvertes
- `src/lib/photoExport.ts` lu : RAS (canvas → JPEG 320 px, limite doc Firestore 1 Mo largement respectée).
- Comportements dépendant de l'exécution réelle (émulateur hors-ligne, navigateurs mobiles pour le téléchargement) n'ont pas pu être reproduits : revue statique uniquement, d'où les confiances « Moyenne » sur DATA-03, DATA-10, DATA-11.
- La revue des règles elles-mêmes (DATA-10 propose une piste côté règles) est laissée à l'agent dédié.
