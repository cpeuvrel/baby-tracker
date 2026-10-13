# Revue 07 — Formulaires, graphiques et composants partagés

Périmètre lu en entier : `FeedingForm`, `DiaperForm`, `BathForm`, `GrowthForm`, `MedicationForm`, `DateTimeField`, `TimeSelect`, `DurationInput`, `ReminderSettingsModal`, `lib/datetimeInput.ts`, `test/timeFields.ts`, `charts/GrowthPercentileChart`, `MetricGraph`, `MetricCalendar`, `WeekTimelineChart`, `TimelineGrid`, `DailyTimeline`, `TrendRow`, `TrendEntriesList`, `TrendMetricIcon`, `icons.tsx`, `BlobIcon`, `EmptyState`, `Modal`, `test/setup.ts`, `test/fakeSnapshot.ts`, `test/mockAuthState.ts` + tous les tests associés. Appelants vérifiés : `ActivityPage`, `DailyTimeline`, `TrendDetailPage`, `GrowthDetailPage`, `SleepEntryEditModal`, `SleepTimerModal`, `NighttimeHoursPage`, `hooks/useNow`, `hooks/useEntriesInRange`, `lib/appTime`, `lib/timeline`, `lib/weekTimeline`, `lib/trendMetrics`, repositories `feedingEntries`/`growthEntries`/`reminders`.

Note : la mission mentionne Recharts, mais aucun graphique n'utilise cette librairie (SVG/CSS maison) — voir UI-18.

---

### [UI-01] `Modal` vole le focus à l'input en cours de saisie à chaque re-render du parent
- **Sévérité** : Haute
- **Catégorie** : bug
- **Fichier(s)** : `src/components/Modal.tsx:31-38`, `src/pages/ActivityPage.tsx:118,166`, `src/components/DailyTimeline.tsx:81`, `src/pages/TrendDetailPage.tsx:318-324`, `src/pages/GrowthDetailPage.tsx:250`
- **Constat** : l'effet de `Modal` (l.31-38) dépend de `[onClose]` et fait `dialogRef.current?.focus()` à chaque exécution. Or tous les appelants passent une closure recréée à chaque render : `closeModal` non mémoïsé dans `ActivityPage` (l.166) et `DailyTimeline` (l.81), fléchées inline `() => setEditing(null)` dans `TrendDetailPage`/`GrowthDetailPage`. `ActivityPage` se re-rend toutes les 30 s via `useNow()` (l.118, `useNow.ts:3`) et à chaque snapshot Firestore (hooks `useRecent*`, `useActiveSleepEntry`) ; `DailyTimeline` à chaque snapshot de `useDayTimeline`. Chaque re-render → nouvel `onClose` → cleanup + ré-exécution de l'effet → le dialog reprend le focus et l'input actif le perd.
- **Impact** : un parent qui tape des notes dans `FeedingForm`/`GrowthForm` depuis Activity voit le clavier mobile se fermer toutes les 30 s (ou dès que l'autre parent enregistre quelque chose). Pire dans `TimeSelect` : le blur efface le `draft` (`TimeSelect.tsx:48`) ; si le focus est volé après le « 1 » de « 19 », l'heure reste « 01 ».
- **Solution proposée** : dans `Modal.tsx`, séparer les deux responsabilités :
  ```tsx
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => { dialogRef.current?.focus() }, [])          // focus une seule fois au montage
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
  ```
  Test à ajouter dans `Modal.test.tsx` : rendre un `<input>` enfant, lui donner le focus, `rerender` avec un nouveau `onClose={vi.fn()}`, puis `expect(input).toHaveFocus()` ; vérifier qu'Escape appelle bien le *dernier* `onClose`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-02] `WeekTimelineChart` fige la « semaine courante » au montage : après minuit dimanche→lundi, les entrées du jour ne sont plus chargées
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/components/WeekTimelineChart.tsx:45-53,62-74,104`
- **Constat** : `currentWeekStart = useMemo(() => startOfWeek(new Date()), [])` (l.45) n'est calculé qu'au montage ; `range.end = currentWeekStart + 7 j` (l.47) borne les 5 souscriptions Firestore (`useEntriesInRange`, `where('… ', '<', range.end)`). `todayKey` (l.104) est lui recalculé à chaque render. Passé minuit dans la nuit de dimanche à lundi, `todayKey` sort de `dayKeys` : plus de colonne « aujourd'hui », et les entrées du lundi (hors `range.end`) n'apparaissent jamais tant que le composant reste monté. De même, le bloc d'un sommeil en cours (l.69 `Date.now()` dans un `useMemo` déps `[dayKeys, sleep]`) ne grandit qu'à l'arrivée d'un nouveau snapshot.
- **Impact** : PWA laissée ouverte sur l'onglet History pendant la nuit (cas réel : parents qui consultent le soir) → le lundi matin, la semaine affichée est l'ancienne et le biberon de 6 h n'est pas visible jusqu'à un changement d'onglet.
- **Solution proposée** : prendre l'heure depuis `useNow()` (existe déjà, `src/hooks/useNow.ts`) et dériver la semaine du jour courant : `const now = useNow(); const todayKey = dayKey(now); const currentWeekStart = useMemo(() => startOfWeek(parseDayKey(todayKey)), [todayKey])` ; utiliser `now.getTime()` à la place de `Date.now()` l.69 et l'ajouter aux déps du `useMemo`. Test : `vi.useFakeTimers()` + `setSystemTime` dimanche 23:59, `render`, avancer de 2 min + `act(advanceTimersByTime(30_000))`, vérifier que la dernière colonne porte la classe `is-today` et que `useEntriesInRange` a été rappelé avec un `range.end` au mardi.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-03] Validation numérique contournée : volumes/poids négatifs ou nuls enregistrés tels quels
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/components/FeedingForm.tsx:32,76-83`, `src/components/GrowthForm.tsx:40-47,83-114`, `src/components/Modal.tsx:70-78`
- **Constat** : les inputs portent `min="0"`/`step`, mais le bouton « Save » du header de `Modal` est `type="button"` hors du `<form>` et appelle `submit()` directement : la validation native n'est jamais exécutée (seule la touche Entrée dans un champ déclenche `onSubmit` et donc la validation). Côté code, `Number(volumeMl)` et `Math.round(Number(weight) * …)` acceptent `-120`, `0`, `1e5`. Un volume `0` est ensuite compté dans `computeFeedingStats`/`averageVolumeByDay` (moyenne tirée vers le bas) ; un poids `0` donne `zScore = log(0) = -∞` dans `growthPercentiles.ts:45` (percentile 0, projection absurde) ; `6200` saisi en kg (réflexe « grammes ») devient 6 200 000 g sans alerte.
- **Impact** : stats Trends et courbes de croissance faussées par une faute de frappe, sans aucun message.
- **Solution proposée** : (1) donner un `id` au `<form>` et, dans `Modal`, accepter `headerAction.formId` pour rendre `<button type="submit" form={formId}>` — la validation native (`min`, `step`, `required`) s'applique alors aussi au bouton du header ; (2) ajouter une garde explicite partagée `src/lib/numberInput.ts` : `parseOptionalPositive(text): number | null | 'invalid'` (null si vide, 'invalid' si `!Number.isFinite(n) || n <= 0`), utilisée par `FeedingForm` (volume) et `GrowthForm` (3 mesures), avec un `<p role="alert">` sous le champ et `return` dans `submit()` ; (3) bornes de plausibilité dans `GrowthForm` (poids 0,3–30 kg, taille 20–130 cm, PC 20–60 cm) avec `window.confirm` au-delà. Tests : volume `-5` et `0` → `logFeeding` non appelé + alerte ; poids `0` → `addGrowthEntry` non appelé.
- **Complexité du fix** : M
- **Confiance** : Haute

---

### [UI-04] Les 5 formulaires ferment la modale et avalent les erreurs d'écriture Firestore
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/components/FeedingForm.tsx:37-41,52`, `src/components/DiaperForm.tsx:34,45,61`, `src/components/BathForm.tsx:28-30,43`, `src/components/GrowthForm.tsx:51-53,66`, `src/components/MedicationForm.tsx:39-41,54`
- **Constat** : chaque `submit`/`handleDelete` fait `void repo(...)` puis `onClose()` immédiatement. Un rejet (permission-denied si les règles refusent, `Timestamp.fromDate(Invalid Date)` qui jette, quota) finit en *unhandled rejection* : rien n'est affiché, la modale est fermée comme si c'était enregistré, la saisie est perdue. `SleepEntryEditModal.tsx:64` montre le bon pattern (`.catch(alertSleepAlreadyRunning)`), absent ici. Le mode hors-ligne est couvert par `persistentLocalCache` (`firebase.ts:25`), ce finding concerne les vrais rejets.
- **Impact** : perte silencieuse d'une entrée (ex. règle Firestore resserrée côté `firestore.rules`, document supprimé par l'autre parent entre-temps → `updateDoc` sur doc inexistant rejette `not-found`).
- **Solution proposée** : créer `src/lib/reportWriteError.ts` : `export function reportWriteError(action: string) { return (error: unknown) => { console.error(error); window.alert(\`Could not ${action}. Please try again.\`) } }` et remplacer chaque `void repo(...)` par `repo(...).catch(reportWriteError('save the entry'))` (idem delete). Optionnel : ne fermer la modale qu'après résolution (`await`, bouton Save `disabled` pendant l'attente) — mais cela ralentit l'UX hors-ligne, donc le `catch` seul est le compromis recommandé. Test par formulaire : `logFeeding.mockRejectedValue(new Error('denied'))`, `vi.spyOn(window,'alert')`, vérifier l'appel.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-05] `TimelineGrid.onReachStart` est rappelé à chaque événement scroll dans la zone de départ
- **Sévérité** : Basse
- **Catégorie** : perf
- **Fichier(s)** : `src/components/TimelineGrid.tsx:104-110`, `src/components/WeekTimelineChart.tsx:40-43,100`
- **Constat** : `handleScroll` appelle `onReachStart?.()` dès que `scrollLeft < clientWidth`, à chaque événement `scroll` (plusieurs par geste, un par frame en défilement inertiel). `loadEarlierWeeks` fait `setWeeks(c => c + 8)` en mise à jour fonctionnelle : si deux événements arrivent avant le commit React (et le `useLayoutEffect` l.98-102 qui repousse `scrollLeft`), les incréments s'additionnent (8 → 24 semaines au lieu de 16), élargissant d'autant les 5 requêtes Firestore (`useEntriesInRange`).
- **Impact** : lectures Firestore inutiles (jusqu'à 104 semaines × 5 collections) et re-renders lourds sur un simple swipe appuyé.
- **Solution proposée** : rendre l'appel idempotent par premier jour : dans `TimelineGrid`, `const requestedFor = useRef<string | null>(null)` ; dans `handleScroll` : `if (scroller.scrollLeft < scroller.clientWidth && requestedFor.current !== firstKey) { requestedFor.current = firstKey; onReachStart?.() }`. Test : deux `fireEvent.scroll` consécutifs à `scrollLeft = 0` → `onReachStart` appelé une seule fois (puis une fois de plus après changement de `dayKeys`).
- **Complexité du fix** : S
- **Confiance** : Basse (le fenêtrage exact dépend du timing React/navigateur ; le bug est plausible mais non reproduit, la garde est peu coûteuse)

---

### [UI-06] `ReminderSettingsModal` écrit dans Firestore à chaque chiffre tapé, y compris des heures intermédiaires fausses
- **Sévérité** : Basse
- **Catégorie** : perf
- **Fichier(s)** : `src/components/ReminderSettingsModal.tsx:42-45`, `src/components/TimeSelect.tsx:53-55`
- **Constat** : `TimePartInput` commite chaque chiffre valide (« 1 » → `01`, puis « 9 » → `19`). `handleTimeChange` fait un `setReminder` (setDoc) à chaque commit : taper « 08:30 » depuis « 09:00 » produit les écritures `00:00`, `08:00`, `08:03`, `08:30`. Si une Cloud Function réagit au document `reminders` (planification), elle est déclenchée 4 fois avec des valeurs transitoires. L'effet l.28-33 resynchronise aussi l'état depuis chaque snapshot retour.
- **Impact** : écritures/déclenchements inutiles ; risque de flicker de l'état local si un snapshot ancien arrive après une frappe plus récente.
- **Solution proposée** : ne persister qu'une valeur stable : soit `TimeSelect` expose `onBlur`/commit uniquement quand les deux parties sont complètes, soit dans la modale un `useEffect` debounce (500 ms) sur `timeOfDay` qui appelle `setReminder`, soit sauvegarde au `onClose`. Adapter le test « saves the reminder when the time changes » (attendre le debounce avec `vi.useFakeTimers`).
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-07] `handleEnableNotifications` reste bloqué en `requesting` si `saveFcmToken` rejette
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/components/ReminderSettingsModal.tsx:47-56`
- **Constat** : `requestNotificationToken` est protégé (`messaging.ts:19-20` retourne `null`), mais `await saveFcmToken(user.uid, token)` ne l'est pas : un rejet laisse `notificationStatus === 'requesting'`, bouton désactivé définitivement, et une *unhandled rejection*. Aucun garde-fou non plus si la modale est démontée pendant l'`await`.
- **Impact** : l'utilisateur ne peut plus réessayer sans fermer/rouvrir ; le token n'est pas enregistré et aucun message ne le dit.
- **Solution proposée** : envelopper dans `try { … } catch { setNotificationStatus('denied') }` et élargir le texte de l'alerte (« Notifications could not be enabled… »). Test : `saveFcmToken.mockRejectedValue(new Error())` → `findByRole('alert')` et bouton ré-activé.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-08] Pré-remplissage `GrowthForm` non arrondi : décimales parasites et `stepMismatch` qui bloque la soumission par Entrée
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/components/GrowthForm.tsx:26-34,86-88`
- **Constat** : `String(entry.weightG / weightUnitToGrams)` : en impérial `4536 / 453.592` affiche `10.000176366843033` ; en métrique un poids de `6235 g` donne `6.235` alors que l'input a `step="0.01"`. Le bouton Save du header contourne la validation (cf. UI-03) mais la touche Entrée passe par `onSubmit` et le navigateur bloque la soumission avec une bulle « valeur invalide ». Idem taille `623 mm` → `62.3` OK, mais PC `345 mm` → `34.5` OK ; le problème touche le poids au gramme et tout l'impérial.
- **Impact** : comportement incohérent Save/Entrée, affichage illisible en impérial (mode encore atteignable via `localStorage`, cf. `useUnitPreference`).
- **Solution proposée** : formater à l'initialisation : `const fmt = (v: number, d: number) => String(Number(v.toFixed(d)))` avec `d = unit === 'imperial' ? 2 : 3` pour le poids et `1` pour les longueurs ; et passer `step="any"` (ou `step="0.001"`) sur le poids pour que la validation native accepte les grammes. Test : entrée `weightG: 6235` → `toHaveValue(6.235)` et Entrée dans le champ déclenche `updateGrowthEntry`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-09] `MetricCalendar` : étiquettes d'axe décalées jusqu'à 59 min en mode « rolling »
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/components/MetricCalendar.tsx:8-15,104`, `src/pages/TrendDetailPage.tsx:74`
- **Constat** : `axisLabels(startSeconds)` arrondit à l'heure (`Math.floor(startSeconds / 3600)`), alors que `rollingDayFrame(now)` démarre la fenêtre à l'heure exacte de `now` (ex. 14:37:12). Les lignes de grille de `TimelineGrid` (l.133-139) sont aux fractions i/8 de la fenêtre, soit 14:37, 17:37… mais étiquetées « 14 », « 17 »… Les blocs de sommeil, eux, sont positionnés exactement (`fractionOfDay`), donc visuellement décalés par rapport aux libellés.
- **Impact** : lecture fausse de l'heure d'un sommeil jusqu'à une heure près dans la vue Calendar en mode fenêtres glissantes.
- **Solution proposée** : soit arrondir `now` à l'heure dans `TrendDetailPage` avant `rollingDayFrame` (`zonedTime(y, m, d, hour)`), soit libeller au format `HH:mm` à partir de `startSeconds` réel : `const m = Math.round(startSeconds / 60); label = pad((Math.floor(m/60) + 3*i) % 24) + ':' + pad(m % 60)`. Test dans `MetricCalendar.test.tsx` avec `frame = rollingDayFrame(new Date('2026-03-05T14:37:00+01:00'))` → premier libellé `14:37`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-10] `DurationInput` : valeurs négatives acceptées/affichées, ids DOM codés en dur
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/components/DurationInput.tsx:8-9,16-19,25-27,37-39`, `src/components/SleepEntryEditModal.tsx:45-48`
- **Constat** : `min="0"`/`max="59"` ne sont pas appliqués dans `handleChange` : `Number('-5')` passe et donne un total négatif. Inversement, quand `SleepEntryEditModal` fournit un `totalMinutes` négatif (fin avant début), l'affichage devient `hoursPart = -1`, `minutesPart = -30`. Les ids `sleep-duration-hours/minutes` sont fixes : deux instances (ou un autre formulaire réutilisant le composant) casseraient l'association `label`/`input`.
- **Impact** : durée négative propagée à `endedAt` ; affichage absurde ; a11y cassée si réutilisé.
- **Solution proposée** : `const hours = Math.max(0, Number(hoursValue) || 0)`, idem minutes ; `if (!Number.isFinite(...)) return` ; affichage `Math.max(0, totalMinutes)` ; prop `idPrefix = 'sleep-duration'`. Test : `fireEvent.change(hours, '-1')` → `onChange` non appelé ou clampé à 0 ; `totalMinutes={-30}` → affiche `0`/`0`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-11] `DateTimeField` : impossible de vider la valeur ; effacer la date la remplace silencieusement par aujourd'hui
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/components/DateTimeField.tsx:7,19-27`, `src/components/TimeSelect.tsx:53`, `src/components/SleepEntryEditModal.tsx:58-63`
- **Constat** : le contrat dit `'' when not set`, mais via l'UI : le bouton « effacer » du `input[type=date]` (Chrome Android) envoie `change('', time)` → `datePart = today` (l.25) : une entrée du 3 mars en cours d'édition passe au 12 octobre sans que l'utilisateur ait rien validé. Et `TimePartInput` ignore les chiffres vides (l.53) : l'heure ne peut jamais redevenir `''`. Conséquence : le chemin « sans heure de fin, le sommeil repart » de `SleepEntryEditModal` (commentaire l.59) n'est atteignable qu'en vidant les deux champs de `DurationInput`.
- **Impact** : déplacement accidentel d'une entrée à aujourd'hui ; fonctionnalité documentée inaccessible.
- **Solution proposée** : dans `change`, si `nextDate === ''` et qu'une date existait, propager `onChange('')` (la valeur devient « non définie ») plutôt que `today`, et réserver « aujourd'hui » au seul cas « heure saisie en premier sans date » (`!date && nextTime`). Les formulaires qui exigent une date doivent alors refuser `''` dans `submit()` (déjà le cas pour `endedAt`, à ajouter pour `occurredAt` : `if (!occurredAt) return`). Test `DateTimeField.test.tsx` (absent aujourd'hui) : date effacée → `onChange('')` ; heure saisie sans date → date du jour.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-12] `GrowthPercentileChart` écarte silencieusement les mesures après 24 mois
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/components/charts/GrowthPercentileChart.tsx:37-41,123-128,149-151`, `src/pages/GrowthDetailPage.tsx:62-70,136-143`
- **Constat** : `ageAxis` plafonne à 24 mois et `plotted`/`values` filtrent `ageMonths <= axis.max` ; `GrowthDetailPage` ne filtre ni n'avertit. Pour un enfant de plus de 2 ans, toute nouvelle pesée disparaît du graphique (la liste la montre), sans message. (`ageInMonths` clampe à 0, donc pas de point à gauche de l'axe.)
- **Impact** : l'utilisateur croit que l'enregistrement a échoué ; le graphique devient inutile après 24 mois sans explication.
- **Solution proposée** : dans `GrowthDetailPage`, calculer `const hidden = childPoints.filter(p => p.ageMonths > 24).length` et afficher sous le graphique `<p className="growth-chart-note">{hidden} measurement(s) after 24 months not shown (WHO range)</p>` ; alternativement, étendre `ageAxis` à `ceil(oldest/3)*3` et laisser les courbes s'arrêter à 24. Test chart : point `ageMonths: 30` → 1 seul cercle `r=7` + note visible côté page.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-13] `aria-label` posés sur des `<div>` sans rôle (ignorés par les lecteurs d'écran)
- **Sévérité** : Basse
- **Catégorie** : a11y
- **Fichier(s)** : `src/components/MetricGraph.tsx:96-98`, `src/components/MetricCalendar.tsx:100`
- **Constat** : `<div className="metric-graph" aria-label="Metric graph">` et `<div className="metric-calendar" aria-label="Metric calendar">` : un `aria-label` sur un élément générique n'est pas exposé (règle axe `aria-allowed-attr`/« aria-label on div »). `DailyTimeline` et `WeekTimelineChart` utilisent correctement `<section aria-label>`.
- **Impact** : les régions graphiques ne sont pas annoncées ; lint a11y en échec si ajouté.
- **Solution proposée** : remplacer par `<section aria-label=…>` (ou `role="group"`). Les tests `MetricCalendar.test.tsx` n'y font pas référence, rien à ajuster ; ajouter `getByRole('region', { name: 'Metric graph' })` dans `TrendDetailPage.test.tsx`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-14] Aucune restauration automatique des spies entre tests (`restoreMocks` absent)
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `vitest.config.ts:11-37`, `src/test/setup.ts:6-8`, `src/components/FeedingForm.test.tsx:122`, `src/components/BathForm.test.tsx:70`
- **Constat** : `setup.ts` ne fait que `cleanup()` ; la config n'active ni `restoreMocks` ni `clearMocks`. `vi.spyOn(window, 'confirm').mockReturnValue(true)` et les `vi.spyOn(AuthContext, 'useAuth')` persistent donc pour les tests suivants du même fichier : l'ordre des `it` devient porteur (un test « annule la suppression » ajouté avant un `mockReturnValue(true)` passerait ou échouerait selon sa position).
- **Impact** : tests fragiles et faux positifs lors d'ajouts.
- **Solution proposée** : dans `vitest.config.ts` → `test: { restoreMocks: true, … }` (ou `afterEach(() => vi.restoreAllMocks())` dans `setup.ts`). Les `beforeEach` qui refont `vi.spyOn(...).mockReturnValue(...)` restent valides ; vérifier `WeekTimelineChart.test.tsx` qui re-spy dans `beforeEach` (OK).
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-15] Mocks `useAuth`/`useHousehold` dupliqués dans 14 et 23 fichiers de test
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/components/FeedingForm.test.tsx:34-53`, `DiaperForm.test.tsx:34-50`, `BathForm.test.tsx:34-50`, `GrowthForm.test.tsx:40-56`, `MedicationForm.test.tsx:33-52`, `ReminderSettingsModal.test.tsx:34-50`, `WeekTimelineChart.test.tsx:20-27`, `DailyTimeline.test.tsx:32-39` (+ pages)
- **Constat** : le même bloc de ~18 lignes (`user: { uid: 'uid1' } as User, loading, error, devLoginAvailable, loginWithGoogle, …` puis `household, babies, loading, error, selectedBaby, selectBaby`) est copié dans 14 fichiers pour `useAuth` et 23 pour `useHousehold`. Tout ajout de champ au contexte (ex. nouveau `AuthContext` ou `Baby.photoDataUrl`) oblige à toucher tous ces fichiers ; c'est exactement le rôle de `src/test/` (qui n'a que `fakeSnapshot`, `mockAuthState`, `timeFields`).
- **Impact** : coût de maintenance et divergences (certains fixtures ont `babies: []`, d'autres `[baby]`).
- **Solution proposée** : créer `src/test/mockContexts.ts` : `export function mockAuth(user: Partial<User> = { uid: 'uid1' })` et `export function mockHousehold({ household = …, baby = … } = {})` qui font les `vi.spyOn(...).mockReturnValue(...)` et renvoient les fixtures ; remplacer les blocs dupliqués fichier par fichier.
- **Complexité du fix** : M
- **Confiance** : Haute

---

### [UI-16] Couverture manquante sur les comportements à risque des champs de saisie et des listes
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `src/components/DateTimeField.tsx` (aucun test), `src/components/TimeSelect.test.tsx`, `src/components/TrendEntriesList.test.tsx`, `src/components/MetricGraph.tsx` (pas de test unitaire), `src/components/GrowthForm.test.tsx`, `src/components/FeedingForm.test.tsx`
- **Constat** : (a) `DateTimeField` n'a pas de test : « heure saisie d'abord → date du jour », changement de date conservant l'heure, `disabled`, `max`. (b) `TimeSelect` : le cas documenté « curseur après la valeur » (`07` + `1` + `9` → `19`, l.24-27) n'est pas testé, ni le blur avec draft invalide suivi d'une nouvelle saisie. (c) `TrendEntriesList` : branche `sleep` (« Sleeping / In progress », barre proportionnelle) et `focusDayKey` (jour vide inséré puis trié) non testées. (d) `MetricGraph` : le swipe (`pointerDown`/`pointerUp` ±50 px, clic avalé après swipe) n'est couvert ni ici ni dans `TrendDetailPage.test.tsx`. (e) Formulaires : aucune saisie invalide (négatif, `0`), aucun rejet Firestore (cf. UI-03/UI-04).
- **Impact** : les régressions sur la saisie d'heure (cœur de l'app) et sur la navigation gestuelle passeraient inaperçues.
- **Solution proposée** : ajouter `DateTimeField.test.tsx` (3 cas ci-dessus) ; dans `TimeSelect.test.tsx` un test qui place le curseur en fin (`user.click` puis `{End}`) et tape `19` ; dans `TrendEntriesList.test.tsx` un `kind="sleep"` avec une entrée en cours et un `focusDayKey` absent des entrées ; un `MetricGraph.test.tsx` avec `fireEvent.pointerDown({clientX:200})` + `pointerUp({clientX:100})` → `onNext` appelé et le `click` suivant ignoré ; les tests de validation listés en UI-03/UI-04.
- **Complexité du fix** : M
- **Confiance** : Haute

---

### [UI-17] `fakeSnapshot` ne modélise que `docs` : un `snapshot.empty`/`size` serait silencieusement `undefined`
- **Sévérité** : Nit
- **Catégorie** : tests
- **Fichier(s)** : `src/test/fakeSnapshot.ts:3-9`
- **Constat** : seul `docs[{id, data()}]` est fourni. Les repositories actuels n'utilisent que `snapshot.docs.map(d => (d.id, d.data()))` (vérifié : aucun `.size`, `.empty`, `.forEach`, `docChanges()`, `metadata` en prod ; `reminders.ts:23` utilise `exists()` sur un `DocumentSnapshot`, pas ce helper), donc fidèle *aujourd'hui*. Mais `empty`/`size` manquants valent `undefined` (falsy) : un futur `if (snapshot.empty) return` passerait ses tests à tort. `data()` renvoie aussi toujours la même référence (Firestore renvoie une copie).
- **Impact** : latent ; faux verts si le code évolue.
- **Solution proposée** : compléter : `{ docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb), docChanges: () => docs.map((doc, newIndex) => ({ type: 'added', doc, oldIndex: -1, newIndex })), metadata: { hasPendingWrites: false, fromCache: false, isEqual: () => true } }` et `data: () => ({ ...entry.data })`, `exists: () => true`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-18] Dépendance `recharts` déclarée mais jamais importée
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `package.json:27`
- **Constat** : `recharts` (^3.10) est dans `dependencies` ; `grep -rn recharts src functions/src` ne renvoie rien — tous les graphiques (`GrowthPercentileChart`, `MetricGraph`, `TimelineGrid`) sont en SVG/CSS maison. Pas d'impact bundle (tree-shaking), mais install, audit et lockfile inutiles, et une mission/doc qui parle encore de Recharts.
- **Impact** : confusion et poids d'installation.
- **Solution proposée** : `npm uninstall recharts` (hors règle « ne pas installer » de cette revue : à faire par l'implémenteur) ; mettre à jour les mentions dans `plan.md` si présentes.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [UI-19] `Modal` : Échap jette la saisie sans confirmation alors que le clic hors-dialogue est bloqué pour la protéger ; pas de piège de focus
- **Sévérité** : Nit
- **Catégorie** : a11y
- **Fichier(s)** : `src/components/Modal.tsx:14,33-35,51-58`
- **Constat** : le commentaire l.14 justifie `closeOnOverlayClick=false` par la perte de saisie, mais `Escape` (l.33-35) ferme sans condition. Par ailleurs `aria-modal="true"` sans piège de focus : `Tab` depuis le dernier champ sort vers la page dimmée derrière (clavier physique / tablette).
- **Impact** : mineur sur mobile (pas de touche Échap), incohérence sur desktop.
- **Solution proposée** : ajouter une prop `confirmClose?: () => boolean` ou simplement ne pas lier Échap quand `closeOnOverlayClick` est faux ; pour le focus, boucler `Tab`/`Shift+Tab` sur `dialogRef.current.querySelectorAll('button, input, [tabindex]')` dans le même `keydown`. Test : Tab depuis le dernier bouton → focus sur le premier.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- Gestion du fuseau exemplaire : tout passe par `appTime` (`zonedParts`/`zonedTime`) et les tests tournent en `TZ=America/New_York` pour le prouver ; `fromDatetimeLocalValue`/`toDatetimeLocalValue` round-trippent, y compris aux transitions DST (vérifié par calcul : 02:30 inexistant → 03:30, 02:30 ambigu → occurrence CET).
- `TimeSelect` (saisie 24 h sur clavier numérique, draft/commit, saut auto vers les minutes) est bien pensé et testé ; les helpers `timeFields.ts` reflètent fidèlement son DOM.
- `GrowthPercentileChart` : pas de dépendance, courbes monotones Fritsch–Carlson sans dépassement, hit-test tactile généreux (28 px), `ResizeObserver` stubbé en test, `useWidth` sans boucle de layout.
- `icons.tsx` : tous décoratifs avec `aria-hidden="true"` surchargeable via props ; `TrendRow`/`EntryRowItem` masquent bien les chevrons.
- `MetricCalendar`/`TimelineGrid` : découpage à minuit et bandes de nuit corrects (tests avec positions en %), clés React stables, `aria-pressed` cohérent sur en-têtes et colonnes.

## Zones non couvertes
- `SleepTimerModal.tsx` et `SleepEntryEditModal.tsx` n'ont été lus que comme appelants de `DateTimeField`/`DurationInput` (revue détaillée hors périmètre).
- `index.css` consulté uniquement pour les classes référencées (modal, timeline-grid) ; pas d'audit de contraste.
- Aucun test exécuté (revue statique ; `node_modules` présent mais la consigne demandait de ne pas insister).
