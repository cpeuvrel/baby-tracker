# Revue — logique métier pure (`src/lib`, hooks calculatoires) — préfixe LIB

Périmètre lu en entier : `aggregations.ts`, `trendMetrics.ts`, `timeline.ts`, `weekTimeline.ts`, `activitySummary.ts`, `entrySummary.ts`, `growthMetrics.ts`, `growthPercentiles.ts`, `whoGrowthData.ts`, `age.ts`, `appTime.ts`, `datetimeInput.ts`, `duration.ts`, `historyFilters.ts`, `upcomingVisits.ts`, `visitDate.ts`, `visitItems.ts`, `photoCrop.ts`, `hooks/useDayTimeline.ts`, `useNow.ts`, `useElapsedSeconds.ts`, `useUnitPreference.ts` + tous leurs tests, plus les appelants (`TrendsPage`, `TrendDetailPage`, `GrowthDetailPage`, `DailyTimeline`, `SummarySheet`, `TodayRecap`, `WeekTimelineChart`, `MetricCalendar`, `NighttimeHoursPage`, `TimeSelect`, `repositories/sleepEntries.ts`) pour vérifier les hypothèses. `npx vitest run src/lib src/hooks` : 33 fichiers / 256 tests verts. Les tables WHO ont été vérifiées par script (structure, monotonie, cohérence LMS ↔ percentiles, valeurs connues).

---

### [LIB-01] L'âge en « mois de 30 jours » décale systématiquement les percentiles WHO
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/age.ts:3`, `src/lib/age.ts:12-16`, `src/lib/growthPercentiles.ts:8`, `src/lib/growthPercentiles.ts:33-35`, `src/pages/GrowthDetailPage.tsx:27`, `src/pages/GrowthDetailPage.tsx:67`, `src/pages/GrowthDetailPage.tsx:80`
- **Constat** : `ageInMonths` divise les jours par `DAYS_PER_MONTH = 30` (age.ts:15), et c'est cette valeur qui est passée à `percentileForValue` / `projectOnSamePercentile` et portée sur l'axe du graphe. Or les tables WHO (`whoGrowthData.ts`, « completed months ») sont indexées en mois de 365,25/12 = 30,4375 jours. L'âge est donc surestimé de 1,46 % en continu : un bébé de 365 jours est évalué à 12,17 mois au lieu de 11,99 ; à 720 jours il est jugé « 24 mois » et `isWithinWhoRange` coupe les percentiles ~10 jours trop tôt. Ordre de grandeur du biais près de la médiane : poids à 12 mois ≈ −0,04 SD (≈ 1,5 point de percentile), taille à 12 mois ≈ 2 mm ≈ −0,085 SD (≈ 3 points), ~2 points sur le poids à 24 mois. Le test `age.test.ts:33-37` fige ce comportement (« same 30-day-month approximation »).
- **Impact** : les percentiles affichés (fonction phare de l'écran Growth) sont biaisés vers le bas de 1 à 3 points, et la projection « Today · estimate » dérive un peu plus à chaque mois ; la courbe disparaît avant le 2ᵉ anniversaire.
- **Solution proposée** : dans `age.ts`, introduire `const DAYS_PER_WHO_MONTH = 365.25 / 12` et faire `ageInMonths` diviser par cette constante (garder `DAYS_PER_MONTH = 30` seulement si `formatAge` reste en mois de 30 jours — cf. LIB-08). Aligner `MIN_PROJECTION_GAP_MONTHS = 7 / 30` dans `GrowthDetailPage.tsx:27` sur `7 / DAYS_PER_WHO_MONTH` (ou exporter la constante). Mettre à jour `age.test.ts` (« 60 jours ≈ 1.97 mois ») et ajouter un test : `ageInMonths('2025-01-01', parseDayKey('2026-01-01'))` ≈ 11.99 ; `ageInMonths` à 730 jours reste `isWithinWhoRange`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-02] « Total sleep » n'a pas la même définition dans History (jour de début) et dans Today/Summary/Trends (jour de réveil)
- **Sévérité** : Moyenne
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/aggregations.ts:32-45`, `src/components/DailyTimeline.tsx:67-68`, `src/components/DailyTimeline.tsx:144`, `src/lib/activitySummary.ts:38-45`, `src/lib/trendMetrics.ts:342-345`
- **Constat** : `DailyTimeline` affiche `formatDuration(sleepStats.totalSeconds)` « total sleep » à partir de `computeSleepStats(sleepEntries, 1)`, où `sleepEntries` sont les sommeils *démarrés* ce jour-là (requête par `startedAt`, `buildTimeline` clé sur `startedAt`) et où un sommeil en cours compte 0 (`durationSeconds ?? 0`). Partout ailleurs (`TodayRecap`/`SummarySheet` via `sleepSecondsInRange`, Trends via `sleepWakeDayKey`), un sommeil compte entier le jour où le bébé *se réveille*, et un sommeil en cours compte jusqu'à `now`. Le même « aujourd'hui » donne donc deux totaux différents : à 09:00, History/Today affiche les siestes de la veille + la nuit entière (10 h+) alors que la bannière « Today so far » affiche la nuit (10 h) et History du jour affiche 0 si rien n'a encore démarré.
- **Impact** : le parent compare la carte History du jour (« 2h 30m total sleep ») avec « Today so far 12h sleep » et aucune des deux n'explique sa règle ; la nuit 20:00→06:00 est attribuée au jour J dans History et au jour J+1 dans Trends.
- **Solution proposée** : choisir une règle unique (celle des Trends/Summary, documentée : « compte sur le jour du réveil, sommeil en cours jusqu'à now ») et l'appliquer à `DailyTimeline` : remplacer `computeSleepStats` par `buildTodayTotals({ ...entries }, dayRange(referenceDate), now).sleepSeconds` (ou exporter `sleepSecondsInRange` depuis `activitySummary.ts`), en élargissant le `useEntriesInRange` de `useDayTimeline` d'un jour en arrière pour les sommeils comme le font `TodayRecap`/`SummarySheet` (`queryRange = { start: addDays(range.start, -1), end }`), tout en gardant la liste des lignes clée sur `startedAt` si c'est le comportement Nara voulu. Supprimer alors `computeSleepStats` (son `nightWakings`/`averageSecondsPerDay` ne sont affichés nulle part). Test : `DailyTimeline.test.tsx` avec une nuit 21:00 J-1 → 06:00 J et une sieste en cours, vérifier que le total du jour J = 9 h + sieste jusqu'à now.
- **Complexité du fix** : M
- **Confiance** : Haute

### [LIB-03] `aggregations.ts` et `timeline.ts` : huit helpers morts, aux définitions divergentes, encore testés
- **Sévérité** : Moyenne
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/lib/aggregations.ts:72-158`, `src/lib/timeline.ts:110-115`, `src/lib/timeline.ts:125-130`, `src/lib/aggregations.test.ts`, `src/lib/timeline.test.ts:59-65`, `src/lib/timeline.test.ts:74-81`
- **Constat** : `computeDiaperStats`, `sumSecondsByDay`, `sumVolumeByDay`, `averageVolumeByDay`, `countFeedingSessionsByDay`, `countNightWakingsByDay`, `countDiapersByDay`, `averageOfPoints` (aggregations.ts) ainsi que `nightDayKey` et `lastNDayKeys` (timeline.ts) ne sont référencés que par leurs tests (vérifié par recherche sur `src/` hors `*.test.*`). Ils encodent des règles différentes de celles de `trendMetrics.ts` : `countFeedingSessionsByDay` ne compte que les biberons alors que `feedSessions` compte biberons + solides ; `sumSecondsByDay` clé un sommeil sur son jour de début là où les Trends le clent sur le réveil ; `countNightWakingsByDay` compte comme « réveil nocturne » le coucher lui-même (tout sommeil démarré pendant la nuit). `plan.md` §7 décrit toujours une métrique « Nighttime wake-ups » qui n'existe pas dans `TREND_METRICS`.
- **Impact** : un futur développeur qui réutilise `countFeedingSessionsByDay` ou `countNightWakingsByDay` obtient des chiffres incohérents avec l'écran Trends ; ~120 lignes de tests entretiennent du code sans consommateur.
- **Solution proposée** : supprimer ces exports et leurs `describe` dans `aggregations.test.ts`/`timeline.test.ts` ; garder `DEFAULT_NIGHTTIME_HOURS`, `isDuringNight`, `startsDuringNight`, `computeFeedingStats`, `computeDelta`, `DailyPoint` (utilisés) — et `computeSleepStats` selon l'issue de LIB-02. Si « réveils nocturnes » doit revenir, le définir dans `trendMetrics.ts` comme « sommeils démarrés pendant la nuit **après** le premier sommeil de la nuit » (ou gaps entre segments de nuit), pas via `countNightWakingsByDay`. Mettre à jour `plan.md` §7 (métriques réellement présentes).
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-04] Tests : aucun cas DST, de nuit non chevauchante, ni de `sleepSegments` direct dans `trendMetrics`, tables WHO vérifiées sur 1/6
- **Sévérité** : Moyenne
- **Catégorie** : tests
- **Fichier(s)** : `src/lib/trendMetrics.test.ts`, `src/lib/growthPercentiles.test.ts:67-75`, `src/lib/age.test.ts`, `src/lib/weekTimeline.test.ts`
- **Constat** : `trendMetrics.test.ts` ne couvre que des dates de mars (UTC+1 stable) ; rien sur un sommeil traversant le changement d'heure (29 mars / 25 octobre 2026) alors que `sleepSegments` (l. 276-314), `isNightSleep` (l. 325-336) et `elapsedPeriodDays` (l. 248-258) mélangent instants et heure murale. Aucun test de nuit `start < end` (ex. `00:00–06:00`), ni `start === end`, ni de `sleepSegments` seul (ses coupes à `nightStart`/`nightEnd`/minuit ne sont vérifiées qu'indirectement par des totaux), ni de `filterMetricEntries` pour `napCount`/`sleepLongest` sans `dayKeys`, ni de `computeMetricBreakdown('feedVolume')`, ni de `trendFetchRange`. `growthPercentiles.test.ts` ne vérifie la monotonie en âge que pour `weight/male` et jamais la cohérence `p[k]` ↔ LMS (cf. LIB-05 qui en découle). `age.test.ts` n'a ni cas calendaire (anniversaire) ni cas DST. `weekTimeline.test.ts` ne teste pas `splitIntervalByDay` sur une journée de 23/25 h.
- **Impact** : la zone la plus risquée du code (timezones) n'est protégée que sur le chemin nominal ; une régression DST ou de nuit non chevauchante passe la CI.
- **Solution proposée** : ajouter dans `trendMetrics.test.ts` : (1) nuit 2026-03-28 21:00 → 2026-03-29 07:00 (Paris) : `sleepSegments` donne 3 segments [21:00–00:00 night][00:00–08:00 night… coupé à 07:00][…] et `sleepTotal` = 9 h réelles (pas 10) ; (2) `elapsedPeriodDays(['2026-03-29'], now=2026-03-29T12:00+02:00)` ≈ 12/23 → `max(1, …)` = 1, et sur 2 jours ≈ 1 + 12/23 ; (3) nuit `{start:'00:00', end:'06:00'}` : sieste 22:00–23:00 non nuit, sommeil 23:00–05:00 nuit ; (4) `start === end` (voir LIB-09) ; (5) test direct de `sleepSegments` avec frame rolling. Dans `growthPercentiles.test.ts`, boucler la monotonie et `valueForZ(row, z_p) ≈ row.p[k]` (tolérance 0,3 %) sur les 6 tables. Dans `age.test.ts`, un cas « né le 2025-01-15, le 2026-01-15 → 12m » et un cas à 00:30 heure d'été.
- **Complexité du fix** : M
- **Confiance** : Haute

### [LIB-05] Les courbes étiquetées 2 % et 98 % sont en réalité les percentiles 2,3 % / 97,7 % (±2 SD)
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/growthPercentiles.ts:6`, `src/lib/whoGrowthData.ts:10`, `src/lib/whoGrowthData.ts:22` (et toutes les lignes `p: [...]`)
- **Constat** : en recalculant `valueForZ(row, Φ⁻¹(p))` pour chaque ligne, les 7 percentiles centraux collent aux `p[k]` à < 0,05 %, mais `p[0]` et `p[8]` s'écartent de 0,6–0,9 % sur le poids (ex. garçons naissance : LMS → 2437,9 g pour P2, table 2459,3 g ; 2459,3 g correspond exactement à z = −2, soit P2,3). C'est la convention des CSV CDC « WHO-*-Percentiles » (colonnes P2.3 / P97.7), importés tels quels mais étiquetés `2` et `98` dans `REFERENCE_PERCENTILES`. `percentileForValue` (calcul LMS) n'est pas affecté, seules les courbes de référence tracées par `referenceCurves` et leurs libellés le sont.
- **Impact** : un point du bébé peut s'afficher « 2 % » dans la liste tout en étant dessiné *sous* la courbe « 2 » du graphe (écart ≈ 20 g à la naissance, ≈ 60 g à 12 mois) ; incohérence visible uniquement aux extrêmes.
- **Solution proposée** : soit renommer `REFERENCE_PERCENTILES = [2.3, 5, 10, 25, 50, 75, 90, 95, 97.7]` et adapter la légende du graphe (`GrowthPercentileChart`) ; soit, plus propre, supprimer les `p` stockés et faire `referenceCurves` les dériver : `values: REFERENCE_PERCENTILES.map((p) => valueForZ(row, inverseNormal(p / 100)))` (ajouter une `inverseNormal` type Acklam à côté de `normalCdf`). Ajouter le test de cohérence LMS ↔ `p` de LIB-04 qui aurait détecté l'écart.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-06] Axe des durées courtes : mélange de libellés « 40m », « 1h », « 80m » sur un même graphe
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/trendMetrics.ts:721-739`
- **Constat** : `computeAxisTicks` choisit l'unité (minutes si `max < 2 h`) mais `formatMetricAxisValue` décide tick par tick : `value % 3600 === 0 ? 'Xh' : 'Ym'`. Pour `max = 80 min` (ex. Daytime Nap Length), les ticks sont `[0, 20, 40, 60, 80] min` → libellés `0, 20m, 40m, 1h, 80m`. Pour `max = 100 min` : `0, 50m, 100m`. Non couvert par les tests (`computeAxisTicks` testé avec 50 min et 14 h seulement).
- **Impact** : lecture déroutante de l'axe Y des métriques Nap Length / Wake Window dès que la valeur dépasse 1 h sans atteindre 2 h (cas fréquent : siestes de 60–100 min).
- **Solution proposée** : passer l'unité d'axe au formateur plutôt que la deviner par tick : `export function formatMetricAxisValue(id, value, axisMax)` → `const unit = durationAxisUnit(axisMax); return unit === 3600 ? \`${value / 3600}h\` : \`${Math.round(value / 60)}m\`` (ou formater `≥ 60 min` en `1h20`). Dans `TrendDetailPage.tsx` passer le même `max` qu'à `computeAxisTicks`. Test : `computeAxisTicks('napLength', 80*60).map(v => formatMetricAxisValue('napLength', v, 80*60))` → `['0','20m','40m','60m','80m']`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-07] `sleepSegmentInMetric` évalue la nuit avec l'horloge réelle, pas avec le `now` du calcul
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/trendMetrics.ts:368-386`, `src/lib/trendMetrics.ts:402-425`
- **Constat** : `sleepSegmentInMetric` appelle `isNightSleep(segment.entry, nightRange)` (l. 378, 380) sans transmettre `now`, donc avec `new Date()` par défaut, alors que `metricSleepSegments` reçoit un `now` explicite (figé à l'ouverture de `TrendDetailPage`, l. 171) et que `computeMetricSeries`/`filterMetricEntries` utilisent ce `now`. Pour un sommeil en cours, la fin considérée diffère : une sieste commencée 18:30 et toujours en cours est « jour » pour la série tant que `now` (figé 19:50) < 20:00, mais devient « nuit » dans le calendrier dès que l'horloge réelle passe 20:00, sans re-render cohérent.
- **Impact** : bloc coloré/fade du calendrier en désaccord avec la valeur de la série et la liste Entries pour la sieste en cours ; dans les tests, un `now` fictif ne contrôle pas ce chemin.
- **Solution proposée** : ajouter un paramètre `now: Date = new Date()` à `sleepSegmentInMetric` et le passer depuis `metricSleepSegments` (l. 423) : `sleepSegmentInMetric(id, segment, nightRange, longestIds, now)` → `isNightSleep(segment.entry, nightRange, now)`. Test : `metricSleepSegments('sleepDay', …, now = 19:50)` avec un sommeil en cours démarré 18:30 → `inMetric === true` quelle que soit l'heure système (utiliser `vi.setSystemTime(21:00)`).
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-08] `formatAge` : mois de 30 jours (« 12m 5d » au premier anniversaire) et jour en moins entre 00:00 et 01:00 en été
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/age.ts:18-33`, `src/pages/ChildPage.tsx:108`, `src/pages/FamilyPage.tsx:30`, `src/pages/GrowthDetailPage.tsx:201`, `src/pages/GrowthDetailPage.tsx:241`
- **Constat** : (a) `months = floor(totalDays / 30)` : un enfant né le 15 janvier affiche « 1m 1d » le 15 février, « 12m 5d » le 15 janvier suivant ; l'usage (et Nara) compte des mois calendaires. (b) `totalDays = floor((now − birth) / 86 400 000)` avec `birth` = minuit Paris en heure d'hiver : en heure d'été, `now − birth` est 1 h plus court que le nombre de jours calendaires, donc entre 00:00 et 01:00 (heure de Paris) l'âge est d'un jour trop faible (ex. « 0d » au lieu de « 1d » pour un bébé né hier, et l'anniversaire tombe une heure trop tard).
- **Impact** : âge affiché faux de quelques jours sur l'écran Child/Family et dans la liste Growth ; off-by-one nocturne en été.
- **Solution proposée** : calculer en jours calendaires Paris : `const days = Math.round((startOfDay(now).getTime() - birth.getTime()) / 86_400_000)` (`Math.round` absorbe les ±1 h de DST), puis les mois en calendaire via `zonedParts` : avancer `birth` mois par mois (`zonedTime(y, m + k, d)`) tant que ≤ `startOfDay(now)`, le reste en semaines/jours. Tests : « né 2025-01-15, le 2026-01-15 → `12m` », « né 2025-01-31, le 2025-03-01 → `1m 1d` », « né 2026-06-01, le 2026-06-02T00:30+02:00 → `1d` ».
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-09] Plage nocturne `start === end` acceptée sans validation ; la lib la traite de façon contradictoire
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/pages/NighttimeHoursPage.tsx:21-24`, `src/lib/aggregations.ts:13-19`, `src/lib/trendMetrics.ts:325-336`, `src/lib/weekTimeline.ts:85-94`
- **Constat** : `NighttimeHoursPage` enregistre `{ start, end }` sans vérifier `start !== end` (`TimeSelect` garantit seulement le format `HH:mm`). Avec `20:00–20:00` : `isDuringNight` renvoie toujours `false` (l. 18 : `at >= start && at < start`), `nightFractions` renvoie `[]` (« pas de nuit »), mais `isNightSleep` (l. 330-334) renvoie `true` pour tout sommeil qui *traverse* 20:00 (la coupe `nightStart` est testée indépendamment de `isDuringNight`). Résultat : couches toutes « daytime », bandes de nuit absentes, mais sommeil 19:00→21:00 classé « Nighttime Sleep ».
- **Impact** : un parent qui tape par erreur la même heure obtient des Trends incohérentes sans message.
- **Solution proposée** : dans `NighttimeHoursPage.handleSubmit`, refuser `start === end` (message « From and To must differ », bouton Save désactivé) ; côté lib, rendre `isNightSleep` cohérent avec `isDuringNight` en court-circuitant `if (nightRange.start === nightRange.end) return false` (ou en ne considérant la coupe `nightStart` que si `isDuringNight(nightStart)` est vrai, ce qui est toujours le cas sauf dans ce cas dégénéré). Test : `isNightSleep(19:00→21:00, {start:'20:00', end:'20:00'})` → `false` ; test de page sur la validation.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-10] `gapSamples` : des sommeils imbriqués/chevauchants gonflent les Wake Windows
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/lib/trendMetrics.ts:491-500`, `src/lib/trendMetrics.ts:570-575`
- **Constat** : les gaps sont calculés entre `sorted[i].start` et `sorted[i-1].end` après tri par début. Si un sommeil B est contenu dans A (doublon créé depuis deux téléphones avant le verrou `sleepTimerLock`, ou import Nara avec chevauchement), `gap(A→B) ≤ 0` est ignoré mais le gap suivant est mesuré depuis `B.end` (plus tôt que `A.end`) : la fenêtre d'éveil C−B.end est surestimée de la durée A.end−B.end. Même logique pour `feedInterval` (sans effet, start = end).
- **Impact** : un seul doublon de 8 h de nuit imbriqué fait apparaître une « wake window » de plusieurs heures inexistante et déplace la moyenne.
- **Solution proposée** : suivre la fin maximale vue : `let lastEnd = sorted[0].end; for (i…) { const gap = (start_i − lastEnd)/1000; if (gap > 0) addSample(…); lastEnd = max(lastEnd, end_i) }` (comparer en `getTime()`). Test : sommeils 20:00–06:00 et 22:00–22:30 puis sieste 09:00 → un seul gap de 3 h (06:00→09:00), pas 10 h 30.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-11] Sommeil en cours : mis en avant dans le calendrier Wake Window / Naps mais exclu des valeurs
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/trendMetrics.ts:502-507`, `src/lib/trendMetrics.ts:522-523`, `src/lib/trendMetrics.ts:564-575`, `src/lib/trendMetrics.test.ts:252-253`
- **Constat** : `napCount`, `napLength`, `wakeWindow`, `sleepLongest` ne considèrent que `completedSleeps` (endedAt et durationSeconds non nuls). Pourtant la fenêtre d'éveil qui *précède* le sommeil en cours est entièrement connue (fin du sommeil précédent → `startedAt` du sommeil en cours) et une sieste en cours est bien une sieste. Le calendrier, lui, colore le sommeil en cours en plein (`sleepSegmentInMetric` → `default: true` / `!isNightSleep`) et le test l. 253 attend `['running']` pour `wakeWindow` sur le jour sélectionné : le bloc est mis en avant alors que la valeur du jour est 0.
- **Impact** : à 11:00, « Wake Window » du jour affiche 0 bien que le bébé ait été éveillé 3 h entre la nuit et la sieste en cours (bloc coloré) ; « Daytime Naps » du jour reste à 0 pendant toute la sieste.
- **Solution proposée** : pour `wakeWindow`, construire les évènements avec `end: entry.endedAt ?? now.toISOString()` sur *tous* les sommeils (le gap jusqu'au sommeil en cours est alors compté, celui qui le suit n'existe pas encore) ; pour `napCount`, inclure les sommeils en cours non-nuit (`entries.sleep.filter(e => !isNightSleep(e, nightRange, now))`), et pour `napLength` utiliser `sleepEnd(entry, now) − startedAt` comme le fait déjà `sleepTotal` (l. 555). Garder `sleepLongest` sur les sommeils terminés (documenté). Mettre à jour `trendMetrics.test.ts` (`values('napCount')` → `[2, 1]`, `wakeWindow` du 6 → 2 h 30 entre 06:30 et 09:00).
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-12] Calendrier : un sommeil compté sur un jour hors période est quand même coloré en plein (périodes passées)
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/trendMetrics.ts:402-425`, `src/lib/trendMetrics.ts:439-460`, `src/pages/TrendDetailPage.tsx:124-146`
- **Constat** : sans `focusDayKey`, `inMetric` ne dépend que de `sleepSegmentInMetric` (nuit/jour/longest) et jamais du jour où le sommeil est *compté* (`sleepWakeDayKey`). Pour une période passée (`periodsBack ≥ 1`), la nuit qui commence le dernier soir de la période et se termine le lendemain matin (hors période) a son segment du soir dans `dayKeys` → colorée en plein pour `sleepNight`/`sleepTotal`, alors que `computeMetricSeries` l'attribue au jour suivant (hors période) et que `filterMetricEntries('sleepNight', …, dayKeys)` l'exclut de la liste Entries. À l'inverse, tout est cohérent dès qu'un jour est sélectionné (`onFocusDay`).
- **Impact** : sur « 7 derniers jours » précédents, la dernière colonne montre une nuit pleine couleur qui n'entre ni dans le total ni dans la liste ; le total semble « oublier » une nuit.
- **Solution proposée** : dans `metricSleepSegments`, appliquer la même règle de jour que `sleepMetricDayKey` même sans focus : `const counted = (entry) => inPeriod.has(sleepMetricDayKey(id, entry, now, frame))` et `inMetric: sleepSegmentInMetric(...) && counted(segment.entry) && onFocusDay(segment.entry)` (pour `sleepLongest`, `longestIds` le fait déjà). Test : période `['2026-03-04','2026-03-05']` avec la nuit du 5 au 6 → segments du 5 présents mais `inMetric === false` pour `sleepTotal`/`sleepNight`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-13] Sommeil terminé avec `durationSeconds` null : affiché « 0m » et exclu des naps / longest / wake windows
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/lib/entrySummary.ts:101`, `src/lib/trendMetrics.ts:502-507`, `src/lib/trendMetrics.ts:359`, `src/lib/babyExport.ts:398`
- **Constat** : le modèle autorise `endedAt` renseigné et `durationSeconds: null` ; l'import Nara le produit si la colonne « [Sleep] Duration (Seconds) » est vide (`row[SLEEP_DURATION] ? Number(...) : null`) et l'import CSV maison via `num(row[DURATION])`. Dans ce cas `summarizeSleepRow` affiche `formatDuration(0)` = « 0m » avec `barFraction 0`, `completedSleeps` écarte l'entrée (donc absente de `napCount`, `napLength`, `sleepLongest`, `wakeWindow`) alors que `sleepTotal`/`sleepDay`/`sleepNight` la comptent via `end − start`. Deux sources de vérité pour une même durée.
- **Impact** : après un import, certaines siestes apparaissent à « 0m » dans History et manquent dans « Longest Sleep » tout en gonflant « Total Sleep ».
- **Solution proposée** : (1) à l'import (`babyExport.ts` les deux chemins), dériver `durationSeconds = secondsBetween(startedAt, endedAt)` quand `endedAt` est présent et la colonne vide ; (2) dans `trendMetrics.ts`, remplacer la lecture de `durationSeconds` par une fonction unique `sleepSeconds(entry, now) = (sleepEnd(entry, now) − startedAt) / 1000` utilisée par `longestSleeps`, `napLength`, `sleepTotal` (et ne filtrer `completedSleeps` que sur `endedAt != null`) ; (3) `summarizeSleepRow` : `duration = entry.durationSeconds ?? secondsBetween(new Date(entry.startedAt), new Date(entry.endedAt))`. Test : entrée `{ endedAt: '…', durationSeconds: null }` → présente dans `sleepLongest` et affichée avec sa durée réelle.
- **Complexité du fix** : S
- **Confiance** : Moyenne (dépend de la présence effective de lignes Nara sans durée ; le code le permet)

### [LIB-14] Perf : `sleepSegments`/`isNightSleep` recalculés sans mémo à chaque rendu de `TrendDetailPage`, avec `Intl.DateTimeFormat` dans la boucle
- **Sévérité** : Basse
- **Catégorie** : perf
- **Fichier(s)** : `src/lib/trendMetrics.ts:276-314`, `src/lib/trendMetrics.ts:325-336`, `src/lib/appTime.ts:34-46`, `src/pages/TrendDetailPage.tsx:124-156`
- **Constat** : chaque `zonedParts` fait un `formatToParts` (coûteux sur mobile, de l'ordre de 5–20 µs) et `zonedTime` en fait deux. `sleepSegments` appelle, par sommeil et par jour calendaire traversé, `addDays` + `zonedParts` + 3 `zonedTime` + `dayKey`/`nextDayKey` (≈ 15 formats), puis `isDuringNight` et `frame.keyOf` par segment ; `isNightSleep` refait une boucle similaire et est appelé par `sleepSegmentInMetric` pour **chaque segment** (pas par entrée), par `metricSamples` (`naps`, même pour les métriques d'alimentation) et par `filterMetricEntries`. `TrendDetailPage` exécute `metricSleepSegments` jusqu'à deux fois par rendu (l. 124 et l. 145) plus `filterMetricEntries`, `computeMetricSeries` ×1 et `computeMetricSummary` ×2, sans `useMemo`, à chaque rendu (sélection d'un jour, snapshot Firestore sur l'une des 10 souscriptions…).
- **Impact** : sur 14 jours (~100 sommeils) on est à quelques milliers d'appels `Intl` par rendu : perceptible (dizaines de ms) sur un téléphone d'entrée de gamme au tap d'une colonne ; pas de bug fonctionnel.
- **Solution proposée** : (1) dans `trendMetrics.ts`, mémoriser `isNightSleep` par `entry.id` dans `metricSleepSegments`/`metricSamples` (une `Map<string, boolean>` locale) et ne calculer `naps`/`bottlesWithVolume` que dans les `case` qui les utilisent ; (2) dans `TrendDetailPage`, envelopper `sleepSegments`, `calendarSleepSegments`, `shown`, `series`, `currentAvg`, `previousAvg` dans des `useMemo` dépendant de `[metric.id, currentDayKeys, current, previous, nightRange, now, frame, selectedDayKey]` ; (3) optionnel : un cache LRU `Map<number, ZonedParts>` dans `zonedParts` (clé = `Math.floor(ms/1000)`), déjà exploité par `offsetAt`. Pas de test fonctionnel requis ; un micro-benchmark vitest `bench` facultatif.
- **Complexité du fix** : M
- **Confiance** : Moyenne (non mesuré, estimation d'ordre de grandeur)

### [LIB-15] Définition « nuit = touche la plage nocturne » : une sieste 19:30–20:10 devient un « Nighttime Sleep »
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/trendMetrics.ts:321-336`, `src/lib/trendMetrics.ts:548-558`
- **Constat** : `isNightSleep` est vrai dès que le sommeil commence pendant la nuit **ou** est encore en cours à `nightStart`. Conséquences aux bords : une sieste tardive 19:30→20:10 (40 min, nuit 20:00–08:00) est entièrement « nuit », exclue de Daytime Sleep/Naps et ajoutée à Nighttime Sleep ; une sieste matinale 07:00→07:45 (avant `nightEnd` 08:00) est aussi « nuit ». Le comportement est documenté et testé (l. 261-265), donc un choix, mais il contredit l'intuition « sieste » et les segments déjà découpés jour/nuit par `sleepSegments` (`segment.night`) qui permettraient une règle plus fine à coût nul.
- **Impact** : « Daytime Naps » et « Nighttime Sleep » bougent de façon surprenante selon quelques minutes de décalage d'une sieste du soir ; la métrique Nap Length perd les siestes les plus longues de fin d'après-midi.
- **Solution proposée** : si le produit le souhaite, remplacer la règle par « majorité de la durée dans la nuit » : `isNightSleep = nightSeconds(entry) > daySeconds(entry)` calculé à partir de `sleepSegments([entry], nightRange, now)` (somme des `end−start` par `segment.night`), avec un seuil minimal (ex. ≥ 30 min dans la nuit) pour les longs sommeils ; ou au minimum ignorer la condition « en cours à nightStart » quand la part nocturne < 15 min. Adapter les tests l. 257-271 (`'5h-9h'` reste nuit, `'19h30-20h10'` devient sieste). À valider avec le propriétaire du produit avant implémentation.
- **Complexité du fix** : S
- **Confiance** : Haute (sur le comportement ; le caractère souhaitable est une question produit)

### [LIB-16] Nit : pluriels figés (« 1 diapers », « 1 sessions ») dans la headline d'un jour
- **Sévérité** : Nit
- **Catégorie** : ux
- **Fichier(s)** : `src/lib/trendMetrics.ts:712-718`
- **Constat** : `formatMetricDayHeadline` concatène `metric.unitWord` (`'sessions'`, `'diapers'`, `'naps'`) sans singulier : un jour à 1 couche affiche « 1 diapers ». `TodayRecap` gère déjà `diaper`/`diapers`.
- **Impact** : coquille visible sur les jours creux.
- **Solution proposée** : ajouter `unitWordSingular` (ou dériver `unitWord.replace(/s$/, '')`) et l'utiliser quand `Math.round(value) === 1`. Test : `formatMetricDayHeadline('diaperCount', 1)` → `'1 diaper'`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [LIB-17] Nit : parsing `HH:mm` dupliqué en 6 endroits
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/lib/aggregations.ts:7-10`, `src/lib/trendMetrics.ts:282-283`, `src/lib/trendMetrics.ts:329`, `src/lib/timeline.ts:101`, `src/lib/timeline.ts:112`, `src/lib/weekTimeline.ts:77`
- **Constat** : `time.split(':').map(Number)` est répété avec des variantes (`minutesOf`, `minutesFraction`, destructurations locales), sans aucune validation du format ; un `nighttimeHours` corrompu en base (`'8:00'` passe, `''` ou `'20h00'` donnent `NaN`) se propage silencieusement en `Invalid Date` dans `zonedTime` et en `false` partout.
- **Impact** : faible aujourd'hui (`TimeSelect` garantit le format), mais chaque nouvelle fonctionnalité recopie le pattern.
- **Solution proposée** : ajouter dans `appTime.ts` `export function parseClock(time: string): { hour: number; minute: number }` (regex `^(\d{1,2}):(\d{2})$`, fallback `DEFAULT_NIGHTTIME_HOURS` ou `throw` en dev) et l'utiliser dans les six sites ; test unitaire de `parseClock` avec `'8:00'`, `'20:00'`, `''`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- `appTime.ts` est solide : toutes les conversions passent par `Europe/Paris` via `Intl`, `zonedTime` gère correctement les trous/doublons DST (vérifié à la main sur 29/03 et 25/10/2026) et les tests couvrent les journées de 23 h/25 h ; `addDays`/`startOfDay`/`nextDayKey` (midi) évitent les pièges classiques.
- Le découpage des sommeils (`sleepSegments`, `splitIntervalByDay`) gère proprement minuit, plusieurs jours, les frames « rolling » et le sommeil en cours ; `elapsedPeriodDays` rend les « per day » honnêtes sur une période en cours ; `trendFetchRange` charge la veille pour les nuits à cheval. Les fenêtres « 7 derniers jours » sont bien inclusives d'aujourd'hui et cohérentes entre `lastNDaysRange`/`dayKeysInRange`/`precedingRange`.
- Tables WHO : 6 tables × 25 lignes, valeurs L/M/S identiques aux publications WHO (poids/longueur/PC, naissance, 12 et 24 mois contrôlés), médiane = `p[4]`, monotonie en âge et en percentile vérifiées ; interpolation linéaire LMS entre mois et clamp hors table corrects, `sex: null` géré en amont par `GrowthDetailPage`.
- Pas de division par zéro ni de liste vide non gérée dans `mean`/`max`/`averageVolumeMl`/`barFraction`/`elapsedPeriodDays` ; `useNow`/`useElapsedSeconds`/`useDayTimeline` nettoient leurs timers et resouscrivent sur `getTime()` (pas sur l'identité de l'objet range) ; `useUnitPreference` encapsule bien `localStorage` en try/catch.
- `photoCrop`, `datetimeInput`, `duration`, `visitDate`, `upcomingVisits` (tri desc confirmé dans le repository) : RAS.

## Zones non couvertes
- Vérification des percentiles WHO limitée à la cohérence interne (LMS ↔ p) et à quelques valeurs connues de mémoire ; pas de comparaison exhaustive avec les CSV CDC d'origine (hors ligne).
- L'impact perf (LIB-14) est estimé, non profilé sur appareil.
