# Revue — pages principales de suivi + hooks de données (préfixe PAGE)

Périmètre lu en entier : `src/pages/{ActivityPage,HistoryPage,TrendsPage,TrendDetailPage,GrowthDetailPage}.tsx` + tests, `src/hooks/{useActiveSleepEntry,useActivityVisibility,useEntriesInRange,useGrowthEntries,useRecentEntries,useRecent*Entries}.ts` + tests, `src/components/{CategoryCard,EntryRowItem,TodayRecap,SummarySheet,ActiveTimersBanner,SleepTimerModal,SleepEntryEditModal,HistoryFiltersModal}.tsx` + tests, `src/lib/sleepAlreadyRunning.ts`. Lus pour vérification : `repositories/sleepEntries.ts`, `lib/{timeline,appTime,datetimeInput,duration,entrySummary,activitySummary,trendMetrics,historyFilters}.ts`, `components/{Modal,DateTimeField,TimeSelect,DurationInput,Layout}.tsx`, `contexts/HouseholdContext.tsx`, `App.tsx`, `firestore.rules`, `lib/firebase.ts`. `npx vitest run` sur `ActivityPage.test.tsx` et `SleepTimerModal.test.tsx` : 29/29 verts.

---

### [PAGE-01] Sauvegarder un sommeil sans heure de fin le remet « en cours » sans la garde d'une heure
- **Sévérité** : Haute
- **Catégorie** : bug
- **Fichier(s)** : `src/components/SleepEntryEditModal.tsx:337-341`, `src/components/SleepEntryEditModal.tsx:356-364`, `src/repositories/sleepEntries.ts:221-237`
- **Constat** : Le bouton « Start Timer » n'est proposé que si le sommeil s'est terminé il y a moins d'une heure, qu'aucun autre ne tourne et qu'il s'agit du dernier (`canStart`, l.337-341, commentaire : « an older one would become an overlapping, back-dated timer »). Mais `submit()` (l.356-364) envoie `endedAt: null` dès que le champ End Time est vide, et `updateSleepEntry` traite alors l'entrée comme un démarrage (`writeRunningSleep` + verrou, l.234-236). Le champ End Time se vide dès que l'utilisateur efface Hours **et** Minutes dans `DurationInput` (`handleDurationChange(null)` l.348-351) ; un « Save » à ce moment-là relance un sommeil vieux de plusieurs jours. Aucune validation ni confirmation.
- **Impact** : En corrigeant la durée d'un sommeil d'il y a 3 jours, un parent vide les deux champs puis tape Save : le sommeil repasse « en cours » depuis 3 jours (bannière « Sleep in progress for 3d 02h », notification système, verrou qui refuse tout nouveau Start Timer). En le stoppant, `durationSeconds` devient ~72 h et fausse Total Sleep / Longest Sleep dans Trends.
- **Solution proposée** : Dans `SleepEntryEditModal.submit()`, refuser la sauvegarde si `endedAt === ''` et `!canStart` : afficher une erreur inline (« Set an end time, or use Start Timer to continue this sleep ») et ne pas appeler `updateSleepEntry`. Variante plus stricte : toujours exiger une fin dans ce modal (la reprise passe uniquement par `handleStart`). Désactiver aussi `headerAction.disabled` quand `endedAt === ''`. Test à ajouter dans `SleepEntryEditModal.test.tsx` : vider Hours/Minutes sur une entrée terminée il y a > 1 h, cliquer Save → `updateSleepEntry` non appelé, message affiché.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-02] Notes tapées pendant qu'un timer tourne : perdues silencieusement
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/components/SleepTimerModal.tsx:156`, `src/components/SleepTimerModal.tsx:205-223`, `src/components/SleepTimerModal.test.tsx:113-132`
- **Constat** : `handleSave` ne fait rien quand `isActive` est vrai (branche `timerEntryId && !isActive` l.206-214, sinon `!isActive && endedAt !== ''` l.215) : il appelle seulement `onClose()`. Or le champ Notes (l.288-294) est éditable pendant que le timer tourne. De plus `startSleep` écrit `notes: ''` (repository l.144) sans reprendre la saisie, et à la réouverture du modal `notes` est initialisé à `''` (l.156) même si l'entrée active a déjà des notes (cas « démarré sur l'autre téléphone avec une note »). Le test l.113-132 (« closes without saving anything when Save is pressed while a timer is active ») fige ce comportement.
- **Impact** : Le parent lance le timer, tape « s'est endormi au sein » puis Save : la note disparaît sans message. Idem si la note est ajoutée en cours de sieste.
- **Solution proposée** : (1) Initialiser `notes` depuis `activeEntry?.notes ?? ''` (via un `useEffect` sur `activeEntry?.id` ou en remplaçant l'`useState` par une valeur dérivée tant que le champ n'a pas été touché). (2) Dans `handleSave`, quand `isActive` : `void updateDoc`-like `updateSleepNotes(household.id, selectedBaby.id, activeEntry.id, notes)` (nouvelle fonction dans `sleepEntries.ts` ne touchant que `notes`, donc hors règles de verrou) puis `onClose()`. (3) Passer `notes` à `startSleep` (nouveau paramètre optionnel). Adapter le test l.113 pour vérifier que les notes sont écrites, et ajouter un test « réouverture avec entrée active ayant des notes → champ pré-rempli ».
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-03] Heure de fin antérieure au début acceptée : durée négative affichée et entrée incohérente persistée
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/components/SleepTimerModal.tsx:242-248`, `src/components/SleepTimerModal.tsx:215-221`, `src/components/SleepEntryEditModal.tsx:343-346`, `src/components/SleepEntryEditModal.tsx:356-364`, `src/lib/duration.ts:154-156`
- **Constat** : `handleEndedAtChange` (Timer) et `durationMinutes` (Edit) calculent `Math.round((end - start) / 60000)` sans borne ; `formatDuration(-300)` rend « -5m » (modulo signé en JS). Au Save, `logSleep`/`updateSleepEntry` écrivent `endedAt < startedAt` avec `durationSeconds = secondsBetween(...)` = 0 (clamp l.155). `firestore.rules` ne valide aucun champ. L'entrée persistée a donc une fin avant le début et une durée nulle : `summarizeSleepRow` affiche « 0m », les segments de la timeline/`metricSleepSegments` travaillent sur start/end réels (segment inversé).
- **Impact** : Une faute de frappe sur l'heure de fin (21:30 au lieu de 23:30 pour un début à 22:00) passe sans erreur, l'entrée apparaît avec « -1h 30m » puis « 0m » après rechargement, et les tendances sont faussées.
- **Solution proposée** : Dans les deux modales, calculer `const invalid = durationMinutes != null && durationMinutes < 0` ; afficher un message (« End time must be after start time »), passer `headerAction.disabled = invalid` et court-circuiter `handleSave`/`submit` si `invalid`. Optionnel : `DurationInput` ignore une valeur négative. Tests : dans `SleepTimerModal.test.tsx` et `SleepEntryEditModal.test.tsx`, poser End Time < Start Time → Save désactivé, `logSleep`/`updateSleepEntry` non appelés.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-04] Toute erreur d'écriture est traduite en « Another sleep timer is already running. »
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/components/SleepTimerModal.tsx:190-201`, `src/components/SleepTimerModal.tsx:209-213`, `src/components/SleepEntryEditModal.tsx:358-362`, `src/components/SleepEntryEditModal.tsx:372`, `src/lib/sleepAlreadyRunning.ts:2-4`
- **Constat** : `alertSleepAlreadyRunning` est utilisé comme `.catch` générique. Dans `SleepEntryEditModal.submit`, quand `endedAt` est renseigné, `updateSleepEntry` fait un simple `updateDoc` qui ne touche pas au verrou (repository l.235) : un refus ne peut donc jamais venir d'« un autre sommeil en cours », mais c'est pourtant ce message qui s'affiche (ex. session expirée → `permission-denied`, règle future de validation, `Timestamp.fromDate(Invalid Date)` qui lève). Les autres écritures (`stopSleep`, `logSleep`, `deleteSleepEntry`, `updateSleepStart`) sont `void` sans aucun retour d'erreur.
- **Impact** : Message faux qui envoie le parent chercher un timer fantôme ; ou, pour les `void`, perte silencieuse d'une saisie (le modal s'est déjà fermé).
- **Solution proposée** : Dans `sleepAlreadyRunning.ts`, exposer `alertSleepWriteFailed(error: unknown, lockInvolved: boolean)` : si `lockInvolved && (error as FirestoreError).code === 'permission-denied'` → message actuel ; sinon message générique « Could not save this sleep. Please try again. » + `console.error`. Dans `SleepEntryEditModal.submit`, passer `lockInvolved = endedAt === ''`. Ajouter `.catch(...)` sur `logSleep`, `stopSleep`, `deleteSleepEntry`, `updateSleepStart`. Test : `updateSleepEntry.mockRejectedValue(new Error('network'))` avec une fin renseignée → le message générique s'affiche, pas celui du verrou.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-05] Fenêtre « depuis hier soir » servie par une requête `limit(20)` : troncature silencieuse
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/pages/ActivityPage.tsx:66-67`, `src/pages/ActivityPage.tsx:121-141`, `src/pages/ActivityPage.tsx:173-243`, `src/hooks/useRecentEntries.ts`
- **Constat** : Les cartes affichent « les entrées depuis `activityWindowStart` » (hier à 20:00, soit jusqu'à 28 h) mais les hooks ne ramènent que les 20 documents les plus récents (`RECENT_COUNT`, commentaire « Enough to cover a full day »), que `windowLines` filtre ensuite. Un nouveau-né allaité à la demande dépasse facilement 20 tétées ou 20 couches sur 28 h : les plus anciennes de la fenêtre disparaissent sans indication et le lien « Entries before 20:00 » ment. `maxVolumeMl`/`maxSleepSeconds` (barres proportionnelles) sont calculés sur l'échantillon tronqué. Même limite pour `lastVitamin` (l.211) : si 20 autres médicaments ont été donnés depuis la dernière vitamine D (paracétamol toutes les 6 h sur quelques jours), la ligne affiche « Not yet ».
- **Impact** : Carte incomplète les jours chargés, précisément quand le suivi compte le plus ; ligne Vitamin D fausse après plusieurs jours de traitement.
- **Solution proposée** : Remplacer les `useRecent*Entries(…, RECENT_COUNT)` de la page par `useEntriesInRange(householdId, babyId, { start: windowStart, end: farFuture })` (ou ajouter aux repositories un `subscribeToEntriesSince(start, onChange)` = `where(field, '>=', start) + orderBy desc`), `windowStart` étant stable jusqu'au prochain `nightStart` ; garder une requête `limit(1)` pour la « dernière entrée » (primary) hors fenêtre. Pour la vitamine, soit `limit(1)` avec `where('name', '>=', 'Vitamin') where('name', '<', 'Vitamio')` (préfixe), soit stocker un flag `isVitamin` à l'écriture. Test : `ActivityPage.test.tsx` avec 25 tétées dans la fenêtre → 25 lignes.
- **Complexité du fix** : M
- **Confiance** : Haute

### [PAGE-06] L'écran Activity ouvre 13 à 18 listeners Firestore concurrents, en partie redondants
- **Sévérité** : Moyenne
- **Catégorie** : perf
- **Fichier(s)** : `src/pages/ActivityPage.tsx:120-143`, `src/components/TodayRecap.tsx:12-16`, `src/components/SummarySheet.tsx:38-41`, `src/components/ActiveTimersBanner.tsx:95`, `src/components/SleepTimerModal.tsx:148`, `src/components/SleepEntryEditModal.tsx:329-330`
- **Constat** : ActivityPage : 5 « recent » + growth + active sleep = 7 ; `TodayRecap` : 5 requêtes par plage (hier 00:00 → demain 00:00) ; `ActiveTimersBanner` : 1 (requête identique à celle de la page, dédupliquée par le SDK) ; `SummarySheet` ouvert : 5 de plus, et chaque bascule Today/Last 24 Hours ré-abonne les 5 ; `SleepEntryEditModal` ajoute `useRecentSleepEntries(…, 1)` et un abonnement actif. Les plages de TodayRecap et de la Summary recouvrent les mêmes documents que les « recent ». Avec `persistentLocalCache` le coût en lectures est amorti, mais chaque listener = un `Target` côté client (CPU/mémoire sur mobile) et des lectures facturées au premier chargement et à chaque changement.
- **Impact** : Démarrage plus lent sur téléphone, consommation réseau/batterie, facture Firestore inutile ; complexité pour raisonner sur la cohérence des données entre composants.
- **Solution proposée** : Une seule source pour l'écran : un contexte `ActivityDataProvider` (ou un hook dans `ActivityPage` passé en props) qui s'abonne une fois à la plage `[min(startOfDay(hier), activityWindowStart), +∞)` pour les 5 collections (voir PAGE-05) ; `TodayRecap` et `SummarySheet` (période Today) dérivent leurs totaux de ces données via `buildTodayTotals`/`buildActivitySummary` sans nouveaux listeners ; seule la période « Last 24 Hours » peut nécessiter une plage différente (ou on étend la plage chargée à `now - 24h`). Ajouter un test de non-régression comptant les appels aux `subscribeTo*` dans `ActivityPage.test.tsx` (sans mocker les hooks de plage).
- **Complexité du fix** : M
- **Confiance** : Moyenne (le partage de listeners identiques par le SDK est connu, mais le gain réel dépend du cache local ; non mesuré)

### [PAGE-07] Les hooks n'exposent ni chargement ni erreur : « No entries » affiché pendant le chargement et pour toujours après une erreur
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/hooks/useRecentEntries.ts:17-27`, `src/hooks/useEntriesInRange.ts:23-70`, `src/hooks/useGrowthEntries.ts`, `src/hooks/useActiveSleepEntry.ts`, `src/repositories/sleepEntries.ts:45-48`, `src/pages/ActivityPage.tsx:273-339`
- **Constat** : Tous les hooks démarrent avec `[]` et aucune requête `onSnapshot` des repositories ne passe de callback d'erreur (0 occurrence de `error` dans les 16 `onSnapshot`), contrairement à `HouseholdContext` qui gère `onError`. Un listener qui échoue (index manquant, règle refusée, token expiré) s'arrête définitivement : l'UI garde `[]` et affiche « No entries » / « Not yet » / « 0 mL milk » comme si c'était vrai. Au premier rendu, avant le premier snapshot, les cartes affichent aussi « No entries » puis sautent.
- **Impact** : Un parent croit qu'aucune tétée n'a été loguée (et en relogue une), ou que le timer de sommeil ne tourne pas (`useActiveSleepEntry` → `null`) alors que l'app est simplement en erreur.
- **Solution proposée** : Étendre la signature des `subscribeTo*` avec un `onError?: (e: FirestoreError) => void` transmis à `onSnapshot(q, next, onError)` ; faire retourner aux hooks `{ entries, loading, error }` (ou un `status`), `loading` passant à `false` au premier snapshot ; dans `ActivityPage`/`TodayRecap`, afficher un état « Loading… » tant que `loading`, et une bannière `role="alert"` « Live updates stopped — reload » si `error`. Tests hooks : simuler l'appel du callback d'erreur et vérifier `error`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [PAGE-08] Démarrage du timer : heure d'ouverture du modal, tronquée à la minute, au lieu de l'instant du clic
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/components/SleepTimerModal.tsx:152`, `src/components/SleepTimerModal.tsx:195-201`
- **Constat** : `startedAt` est initialisé une fois à l'ouverture (`toDatetimeLocalValue(new Date())`, précision minute). `startSleep(..., fromDatetimeLocalValue(startedAt))` utilise donc (a) l'heure d'ouverture du modal, pas celle du clic sur Start Timer, (b) arrondie à la minute inférieure. Juste après « Starting… », le compteur affiche déjà jusqu'à 59 s ; si le modal est resté ouvert 10 min (ou ouvert via `?timer=sleep` puis laissé), le sommeil est antidaté de 10 min.
- **Impact** : Petit décalage systématique des durées de sommeil ; compteur qui saute à « 47s » dès le départ.
- **Solution proposée** : Garder un flag `startTouched` (mis à `true` dans `handleStartedAtChange`) ; dans `handleToggleTimer`, `const start = startTouched ? fromDatetimeLocalValue(startedAt) : new Date()` et `setStartedAt(toDatetimeLocalValue(start))`. Test : fake timers, ouvrir le modal, avancer de 5 min, Start → `startSleep` appelé avec `new Date()` courant.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-09] Édition de l'heure de début d'un timer actif : une écriture Firestore par chiffre tapé, et le compteur saute
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/components/SleepTimerModal.tsx:234-237`, `src/components/TimeSelect.tsx:49-56`
- **Constat** : `TimePartInput` commit chaque chiffre valide (`onCommit` dès « 2 » → « 02 », puis « 20 »). Avec un timer actif, `handleStartedAtChange` appelle `updateSleepStart` immédiatement (l.236) : taper « 20 » écrit d'abord 02:00 (le compteur affiche ~18 h, la notification système et l'autre téléphone suivent) puis 20:00. Chaque frappe = une écriture Firestore non gérée (`void`).
- **Impact** : Compteur et bannière qui sautent pendant la saisie, écritures inutiles, et une faute de frappe non corrigée persiste instantanément.
- **Solution proposée** : Garder la saisie en état local (`draftStart`) et n'écrire qu'au blur du champ / au Save (`handleSave` : si `isActive && draftStart !== activeEntry.startedAt` → `updateSleepStart`). À défaut, debounce 600 ms. Adapter le test l.258-275 (attendre le blur/Save).
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-10] Au changement de bébé, les hooks affichent brièvement les données du bébé précédent
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/hooks/useRecentEntries.ts:19-25`, `src/hooks/useEntriesInRange.ts:31-68`, `src/hooks/useGrowthEntries.ts:8-14`, `src/hooks/useActiveSleepEntry.ts:12-18`
- **Constat** : Quand `babyId` passe de `b1` à `b2` (non nul → non nul), l'effet se désabonne puis se réabonne, mais l'état `entries` garde les documents de `b1` jusqu'au premier snapshot de `b2`. Le `setEntries([])` n'est exécuté que si un id devient nul. Pendant ce rendu, le header affiche déjà le nom de `b2` avec « Last feeding 2h ago » de `b1`, et `useActiveSleepEntry` peut annoncer un sommeil en cours pour le mauvais enfant.
- **Impact** : Flash de données erronées lors du switch dans `BabySelector`, plus long hors ligne (cache) ou réseau lent ; pour une famille avec deux enfants c'est le cas nominal.
- **Solution proposée** : Au début de chaque effet (avant `subscribe`), appeler `setEntries([])` (et les 5 setters dans `useEntriesInRange`) ; ou retourner l'état combiné avec `loading` (PAGE-07) et ignorer les snapshots d'un abonnement obsolète via un flag `cancelled` dans le cleanup. Test hook : `rerender` avec un autre `babyId` → `result.current` vide tant que le nouveau `onChange` n'a pas été appelé.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-11] `useActivityVisibility` : JSON non validé (crash possible) et préférence globale malgré une route par bébé
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/hooks/useActivityVisibility.ts:15-22`, `src/hooks/useActivityVisibility.ts:3`, `src/pages/EditActivitiesPage.tsx:5-12`, `src/pages/ActivityPage.tsx:347`
- **Constat** : `readHidden` protège `JSON.parse` mais ne vérifie pas le type : une valeur `{}` ou `null`… (`"null"` → `null` → `hidden.includes` lève `TypeError` à chaque rendu de `ActivityPage`, `TodayRecap`, `SummarySheet`) ; une chaîne `"abc"` passe par `String.prototype.includes` et masque des catégories au hasard. Par ailleurs la route `/account/family/:babyId/activities` et le bouton « Edit Activities » suggèrent un réglage par enfant, mais la clé `baby-tracker:hiddenActivities` est globale (`babyId` ne sert qu'au bouton Back).
- **Impact** : Un localStorage corrompu (extension, migration) rend l'écran principal blanc (erreur non rattrapée) ; avec deux enfants, masquer Growth pour l'aîné le masque aussi pour le nourrisson.
- **Solution proposée** : `readHidden` : `const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((c): c is ActivityCategory => ACTIVITY_CATEGORIES.some(a => a.id === c)) : []`. Pour la portée : `useActivityVisibility(babyId: string | null)` avec clé `baby-tracker:hiddenActivities:${babyId}` (fallback lecture de l'ancienne clé pour migrer), appelé avec `selectedBaby.id` dans ActivityPage/TodayRecap/SummarySheet et `babyId` de l'URL dans EditActivitiesPage. Tests : valeur `"{}"` stockée → toutes visibles ; deux babyId → préférences indépendantes.
- **Complexité du fix** : S (validation) / M (portée par bébé)
- **Confiance** : Haute

### [PAGE-12] GrowthDetailPage : « Boys Percentile » affiché pour un bébé dont le sexe est inconnu
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/pages/GrowthDetailPage.tsx:76`, `src/pages/GrowthDetailPage.tsx:226-235`, `src/pages/GrowthDetailPage.tsx:128-132`
- **Constat** : `sexPercentileLabel = sex === 'female' ? 'Girls Percentile' : 'Boys Percentile'` ; en vue liste la ligne l.226-235 affiche toujours ce libellé, et seul le pourcentage est conditionné à `pointPercentile != null`. Avec `sex: null` chaque ligne montre « Boys Percentile › » sans valeur. Le test l.519-532 (« still allows the list view ») ne vérifie pas ce cas. Accessoirement, le message l.130 renvoie vers « Settings » alors que le sexe se règle dans Account › Family › Child.
- **Impact** : Information fausse (le bébé est présenté comme garçon) et ligne vide ; message qui envoie au mauvais écran.
- **Solution proposée** : `const sexPercentileLabel = sex === 'female' ? 'Girls Percentile' : sex === 'male' ? 'Boys Percentile' : null` ; n'afficher le `<p className="growth-entry-line growth-entry-line-chevron">` que si `sexPercentileLabel` (sinon mettre le chevron sur la ligne de valeur). Remplacer le texte par « Set the baby's sex in Account › Family › {name} to see WHO percentile curves. ». Test : `babyNoSex` + « Show list » → `queryByText(/Boys Percentile/)` absent.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-13] TrendDetailPage affiche « ↑ 0 mL » quand la variation est non nulle mais arrondie à zéro
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/pages/TrendDetailPage.tsx:319`, `src/pages/TrendDetailPage.tsx:464-477`, `src/pages/TrendsPage.tsx:134-136`
- **Constat** : `TrendsPage` neutralise ce cas (`shownDelta = deltaLabel === formatMetricValue(id, 0) ? {direction:'flat'} : delta`, l.135-136). `TrendDetailPage` teste `delta.direction !== 'flat'` sur la valeur brute (`computeDelta` : `value > 0 ? 'up'`), puis affiche `formatMetricValue(id, Math.abs(delta.value))` arrondi (`Math.round` pour volume, dixième pour les comptes, minute pour les durées).
- **Impact** : « ↑ 0 mL More milk than the previous 14 days » ou « ↓ 0m Less sleep » pour une différence de 0,3 mL / 20 s — incohérent avec la liste Trends qui montre « flat » pour la même métrique.
- **Solution proposée** : Extraire dans `lib/trendMetrics.ts` une fonction `displayDelta(id, delta): Delta` reprenant la logique de TrendsPage l.135-136, et l'utiliser aux deux endroits (`const shown = displayDelta(metric.id, delta)` l.319). Test unitaire : `displayDelta('feedVolume', {value: 0.3, direction: 'up'})` → `flat`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-14] Écran blanc (`return null`) pour un paramètre d'URL invalide ou sans enfant sélectionné
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/pages/TrendDetailPage.tsx:261`, `src/pages/GrowthDetailPage.tsx:56`, `src/pages/ActivityPage.tsx:145`, `src/pages/TrendsPage.tsx:106`, `src/pages/ChildPage.tsx:40-55`
- **Constat** : `/trends/foo` et `/growth/foo` (lien périmé, faute de frappe, ancien `metricId` renommé) rendent `null` : header + tab bar mais contenu vide, sans bouton Back. De même, `selectedBaby` devient `null` après suppression du dernier enfant (`deleteBabyWithData` dans ChildPage, aucune garde « dernier enfant ») : Activity, Trends, History restent blancs tant qu'aucun enfant n'est ajouté, et rien ne l'indique.
- **Impact** : Utilisateur bloqué sur un écran vide, sans indication de l'action à faire.
- **Solution proposée** : Pour les params invalides : `if (!metric) return <Navigate to="/trends" replace />` (resp. `/`). Pour l'absence d'enfant : dans `Layout` (ou chaque page) afficher `EmptyState` « No child yet » avec un lien vers `/account/family/add` quand `babies.length === 0`. Tests : `renderPage('not-a-metric')` → redirection vers la liste (remplacer les assertions `toBeEmptyDOMElement` l.60-64 et l.417-421).
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-15] TrendDetailPage en mode « rolling » : chaque changement d'onglet ré-abonne les 10 listeners
- **Sévérité** : Basse
- **Catégorie** : perf
- **Fichier(s)** : `src/pages/TrendDetailPage.tsx:230`, `src/pages/TrendDetailPage.tsx:235-259`, `src/pages/TrendDetailPage.tsx:268-271`, `src/hooks/useEntriesInRange.ts:28-29`
- **Constat** : `changeView` et `toggleDayMode` font `setNow(currentTime())`. En mode `rolling`, `rollingDayFrame(now).startOf` inclut heure/minute/seconde : `currentRange.start` change à la seconde près, donc `startTime`/`endTime` (deps de `useEntriesInRange`) changent → 2 × 5 désabonnements/réabonnements à chaque passage Calendar ↔ Graph ↔ Entries, et un flash de listes vides (état `[]` conservé… cf. PAGE-10 : ici l'ancien état reste jusqu'au snapshot). En mode calendar c'est stable (`parseDayKey`).
- **Impact** : Latence et lectures inutiles à chaque tap sur les onglets en mode 24 h glissantes.
- **Solution proposée** : Ne rafraîchir `now` que pour l'affichage (headline/caption) et abonner avec une plage arrondie : `trendFetchRange` sur `{ start: startOfDay(addDays(currentRange.start, -1)), end: addDays(startOfDay(currentRange.end), 1) }` (plage calendaire englobante, stable dans la journée) puis filtrer côté client avec la plage exacte — les fonctions `computeMetric*` filtrent déjà par `dayKeys`/frame. Test : compter les appels à `useEntriesInRange` (ou aux `subscribeTo*`) après trois `changeView` en rolling → inchangés.
- **Complexité du fix** : S
- **Confiance** : Moyenne (le ré-abonnement est certain ; l'absence d'effet de bord sur les calculs après élargissement de la plage reste à vérifier dans `trendMetrics.ts`, hors périmètre)

### [PAGE-16] Bannière de sommeil : `aria-live` sur un texte qui change chaque seconde
- **Sévérité** : Basse
- **Catégorie** : a11y
- **Fichier(s)** : `src/components/ActiveTimersBanner.tsx:103-106`, `src/components/SleepTimerModal.tsx:267-269`
- **Constat** : `<div role="status" aria-live="polite">` englobe « Sleep in progress for {formatElapsed(sleepElapsed)} » mis à jour toutes les secondes (`useElapsedSeconds`). Idem `modal-counter` avec `aria-live="polite"` dans le modal. Un lecteur d'écran annonce la nouvelle valeur à chaque tick.
- **Impact** : Application inutilisable avec VoiceOver/TalkBack tant qu'un sommeil tourne (annonce continue), y compris sur les autres écrans puisque la bannière est dans `Layout`.
- **Solution proposée** : Retirer `aria-live` du conteneur ; garder `role="status"` sur un `<span>` séparé annonçant uniquement les transitions (« Sleep timer started » / « stopped »), et mettre le compteur dans un élément `aria-hidden="true"` doublé d'un `aria-label` statique sur le bouton (« Sleep in progress, open timer »). Même traitement pour `modal-counter`. Test : `getByRole('status')` ne contient pas le temps écoulé.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-17] Menu « Add to Routine » : pas de fermeture Échap ni de focus, contrairement à `Modal`
- **Sévérité** : Basse
- **Catégorie** : a11y
- **Fichier(s)** : `src/pages/ActivityPage.tsx:366-390`, `src/components/Modal.tsx:232-239`
- **Constat** : Le menu est un `div role="dialog" aria-modal="true"` fait main : aucune gestion d'`Escape`, pas de `focus()` à l'ouverture (`Modal` fait les deux), fermeture uniquement par clic sur l'overlay ou « Cancel ». Le focus reste sur le bouton « + » derrière l'overlay.
- **Impact** : Navigation clavier/lecteur d'écran : l'utilisateur ne sait pas qu'un menu s'est ouvert et ne peut pas le fermer avec Échap.
- **Solution proposée** : Extraire un composant `ActionMenu` (ou réutiliser `Modal` avec `closeOnOverlayClick` et une variante de style « sheet ») qui fait `dialogRef.current?.focus()` et écoute `keydown Escape → onClose`. Test dans `ActivityPage.test.tsx` : ouvrir le menu, `user.keyboard('{Escape}')` → dialog absent.
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-18] Tests : comportements à risque non couverts et un test qui fige une perte de données
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `src/components/SleepTimerModal.test.tsx:113-132`, `src/components/SleepEntryEditModal.test.tsx`, `src/hooks/useRecentEntries.test.ts`, `src/hooks/useEntriesInRange.test.ts`, `src/pages/TrendDetailPage.test.tsx:265-281`, `src/pages/ActivityPage.test.tsx:63-65`
- **Constat** : (1) Le test « closes without saving anything when Save is pressed while a timer is active » valide la perte des notes (PAGE-02). (2) Aucun test sur fin < début (PAGE-03), sur Save avec fin vide dans le modal d'édition (PAGE-01), sur le rejet d'`updateSleepEntry` avec fin renseignée (PAGE-04). (3) Les tests de hooks ne couvrent ni le changement d'id (PAGE-10) ni la ré-souscription quand `range` change (deps `startTime`/`endTime`), alors que c'est la garantie principale d'`useEntriesInRange`. (4) `TrendDetailPage` rolling : seul le libellé « Rolling 24 h, ending at » est testé, aucun calcul. (5) `ActivityPage.test.tsx` mocke `useEntriesInRange` globalement (l.63-65) : `TodayRecap` n'est testé qu'avec des totaux à 0.
- **Impact** : Les régressions sur les écritures de sommeil (le flux le plus sensible : verrou + multi-appareil) passeraient inaperçues.
- **Solution proposée** : Ajouter les tests listés dans PAGE-01/02/03/04/10 ; dans `useEntriesInRange.test.ts`, `rerender` avec une plage différente → ancien `unsubscribe` appelé, nouveau `subscribe` avec la nouvelle plage, et `rerender` avec un objet `range` égal mais nouvelle référence → pas de ré-abonnement ; dans `ActivityPage.test.tsx`, un cas `TodayRecap` avec des entrées (biberon 120 mL aujourd'hui, sommeil terminé ce matin) → « 120 mL milk », durée correcte.
- **Complexité du fix** : M
- **Confiance** : Haute

### [PAGE-19] « Start Timer » dans le modal d'édition ignore les notes/fin modifiées ; `onResumed` avant confirmation
- **Sévérité** : Nit
- **Catégorie** : ux
- **Fichier(s)** : `src/components/SleepEntryEditModal.tsx:371-375`
- **Constat** : `handleStart` n'envoie que `startedAt` à `resumeSleep` ; des notes éditées juste avant sont perdues. `onResumed()` est appelé synchroniquement : si la règle refuse (autre sommeil démarré entre-temps), ActivityPage a déjà basculé sur `SleepTimerModal` en état « Start Timer » pendant que l'alerte s'affiche.
- **Impact** : Perte mineure de saisie ; état visuel transitoire trompeur.
- **Solution proposée** : `resumeSleep(...).then(() => onResumed?.() ?? onClose()).catch(alert…)` et étendre `resumeSleep` d'un paramètre `notes` (merge dans `writeRunningSleep`). Adapter le test l.460-471 (attendre la résolution).
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-20] Lignes des cartes clés par index, et période de Trends non propagée au détail
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/components/CategoryCard.tsx:334-340`, `src/components/EntryRowItem.tsx:3-10`, `src/pages/TrendsPage.tsx:143`, `src/pages/TrendDetailPage.tsx:221`
- **Constat** : `rowList` utilise `key={index}` ; les lignes n'ont pas d'identifiant alors que chaque entrée en a un (`entry.id`). Sans état interne dans `EntryRowItem` ce n'est pas un bug aujourd'hui, mais toute animation/focus futur se décalera à l'insertion d'une entrée en tête. Par ailleurs Trends à « 7d » ouvre un détail en « 14d » (défaut l.221) : la headline change entre les deux écrans.
- **Impact** : Fragilité future ; incohérence visuelle entre liste et détail.
- **Solution proposée** : Ajouter `id: string` à `CategoryCardEntryRow` (`entry.id`, ou `metric` pour les lignes Growth, `'bath'`/`'vitamin'` pour les lignes épinglées) et `key={row.id}`. Dans `TrendsPage`, lier vers `/trends/${id}?days=${days}` et lire `searchParams.get('days')` dans `TrendDetailPage` (validé contre `RANGE_DAYS`).
- **Complexité du fix** : S
- **Confiance** : Haute

### [PAGE-21] Lien « Entries before 20:00 » ouvre History en vue graphique hebdomadaire, pas la liste du jour
- **Sévérité** : Nit
- **Catégorie** : ux
- **Fichier(s)** : `src/pages/ActivityPage.tsx:171`, `src/pages/HistoryPage.tsx:17-18`, `src/pages/HistoryPage.tsx:46-48`
- **Constat** : `handleShowHistory` fait `navigate('/history')` ; `HistoryPage` démarre en `view = 'graph'` sur aujourd'hui. Le libellé promet « les entrées avant 20:00 » (donc hier), l'utilisateur arrive sur le `WeekTimelineChart` et doit choisir hier puis basculer en « Show data ».
- **Impact** : Deux taps supplémentaires et un instant de confusion à chaque usage du lien.
- **Solution proposée** : `navigate('/history', { state: { view: 'data', date: addDays(windowStart, 0) } })` et dans `HistoryPage` initialiser `view`/`selectedDate` depuis `useLocation().state` si présent. Test : clic sur le lien → `DailyTimeline` rendu avec le titre de la veille.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- Les abonnements Firestore sont systématiquement nettoyés (`return subscribe(...)` / cleanup explicite), et `useEntriesInRange` dépend de `getTime()` et non des objets `Date` : pas de ré-abonnement parasite à chaque rendu (TodayRecap/SummarySheet construisent bien des plages stables).
- Gestion du temps saine : tout passe par `appTime.ts` (Europe/Paris, DST géré par `zonedTime`), `activityWindowStart`/`dayRange` sont corrects autour du changement d'heure ; `useNow` se rafraîchit au retour en avant-plan ; `secondsBetween` borne à 0 un `startedAt` futur ; `formatElapsed`/`formatDuration` gèrent > 24 h.
- Le cas « deux timers démarrés en même temps sur deux appareils » est traité de bout en bout (verrou dans les règles, `useActiveSleepEntries` trié, « Stop all », `pendingStart` relâché sur refus).
- `localStorage` : `JSON.parse` et `setItem` encadrés de try/catch partout ; `Modal` gère focus initial, Échap et clic-overlay sans fermeture sur drag.
- Bonne couverture fonctionnelle des pages (navigation, filtres, vues, sélection de jour) avec des assertions par rôle/label accessibles.

## Zones non couvertes
- `MetricCalendar`, `MetricGraph`, `TrendEntriesList`, `WeekTimelineChart`, `DailyTimeline`, `GrowthPercentileChart`, formulaires `*Form.tsx` et `lib/trendMetrics.ts`/`aggregations.ts` : lus ponctuellement pour vérifier des appels, mais revus par un autre agent.
- Les repositories (`src/repositories/*`) ne sont cités que pour étayer PAGE-01/04/07 ; leur revue complète (règles, validation, imports) relève d'un autre agent.
