# Code review complète — baby-tracker (2026-10-12)

Revue statique de l'ensemble du repo, réalisée par 8 agents en parallèle (un périmètre chacun), puis consolidée et dédoublonnée. **Aucun fix n'a été implémenté** : chaque finding propose une solution à valider avant une vague d'implémentation.

## Comment utiliser ce dossier

1. Ce `README.md` est le **tableau de bord** : une ligne par finding (après fusion des doublons), avec sévérité, complexité, modèle suggéré pour l'implémentation et lien vers le rapport détaillé.
2. Les fichiers `01-…md` à `08-…md` contiennent le **détail** de chaque finding (constat, impact, solution proposée, test à ajouter) au format commun : `### [ID] Titre` suivi de sévérité / catégorie / fichiers / constat / impact / solution / complexité / confiance.
3. **Pour valider** : coche `[x]` dans la colonne ✔ les findings à corriger (ou note `[~]` = à corriger autrement, `[-]` = refusé, avec un mot dans la colonne Titre si besoin). La vague d'implémentation suivante lira ce fichier et les rapports détaillés.

## Périmètre et méthode

| Rapport | Périmètre | Findings bruts |
|---|---|---|
| [01-security-infra.md](01-security-infra.md) | `firestore.rules`, CI GitHub Actions, `firebase.json`, Vercel, `sw.ts`, scripts, config | 21 |
| [02-functions-push.md](02-functions-push.md) | Cloud Functions (`functions/src`), push FCM serveur + client, rappels, timer de sommeil | 14 |
| [03-data-layer.md](03-data-layer.md) | Repositories Firestore, contexts Auth/Household, import/export CSV | 18 |
| [04-lib-logic.md](04-lib-logic.md) | Logique pure `src/lib` (agrégations, tendances, timelines, croissance/WHO, âge, dates) | 17 |
| [05-pages-tracking.md](05-pages-tracking.md) | Activity / History / Trends / Growth, hooks de données, timer de sommeil côté UI | 21 |
| [06-app-account-pediatrician.md](06-app-account-pediatrician.md) | `App.tsx`, routing, Layout/Modal, pages Compte/Famille/Enfant, pédiatre, photo | 20 |
| [07-components.md](07-components.md) | Formulaires, champs date/heure, graphiques SVG, composants partagés, helpers de test | 19 |
| [08-tests-tooling.md](08-tests-tooling.md) | Couverture, qualité des tests, outillage (vitest/oxlint/tsc/CI), dette | 18 |

Règles données aux agents : revue statique uniquement, lecture intégrale des fichiers du périmètre, vérification des hypothèses dans le code appelant, pas de findings purement stylistiques, **une solution concrète par finding sans l'implémenter**.

## Baseline (état du repo avant tout fix)

| Vérification | Résultat |
|---|---|
| `npm run lint` (oxlint) | 0 erreur, 26 warnings (13 `react/purity`, 11 `react/set-state-in-effect`, 2 `only-export-components`) |
| `tsc -b --noEmit` (app) | OK |
| `tsc --noEmit` (functions) | OK |
| `vitest run` (app) | 86 fichiers, 587 tests verts |
| `vitest run` (functions) | 3 fichiers, 20 tests verts |
| Couverture (app) | 90,4 % statements, 82,5 % branches, 92,2 % lignes. Trous : `foregroundPush.ts` 9 %, `photoExport.ts` 22 %, `PediatricianVisitPage.tsx` 59 %, contexts ~77 % |

Le repo est globalement en bon état : typage strict, suite de tests large et verte, architecture claire (repositories / hooks / pages), règles Firestore réfléchies (verrou « un seul sommeil »). Les problèmes relevés sont surtout de la robustesse (erreurs avalées, états de chargement absents), de l'infra (règles et index non déployés par la CI), et quelques vrais bugs fonctionnels.

## Synthèse

**148 findings bruts → 127 après fusion des doublons** (plusieurs agents ont vu les mêmes problèmes depuis des angles différents, ce qui renforce la confiance sur ces points).

| Sévérité | Nombre (dédoublonné) |
|---|---|
| Critique | 0 |
| Haute | 4 |
| Moyenne | 40 |
| Basse | 66 |
| Nit | 17 |

Complexité des fixes : 92 S, 32 M, 2 L. Modèle suggéré : 108 Sonnet, 19 Opus (Opus pour les fixes transverses, les règles Firestore, les choix de design et tout ce qui touche à la concurrence/idempotence).

### Les 4 points Haute (à traiter en premier)

1. **FN-01** (= SEC-07, TEST-02) — `checkMedicationReminders` fait une requête `name == X` + `givenAt >= T` qui exige un **index composite absent** de `firestore.indexes.json`. Si l'index n'a pas été créé à la main en console, le rappel médicament échoue et l'exception fait tomber tout le tick. Fix S : déclarer l'index dans le JSON (et le déployer, voir SEC-02). À vérifier en console avant : si l'index existe déjà, le finding reste valable (un futur `deploy --only firestore` le supprimerait).
2. **FN-02** (= SEC-03) — Le rappel médicament est envoyé avec un payload `notification{}` : le SDK FCM l'affiche **puis** le fallback de `onBackgroundMessage` dans `sw.ts` l'affiche une deuxième fois (vérifié dans le code du SDK). Fix : passer en payload `data` only côté function, comme les deux autres pushes, et traiter ce type dans le SW et en avant-plan.
3. **SEC-02** (= TEST-01) — `firestore.rules` et `firestore.indexes.json` ne sont **ni testés ni déployés par la CI** (`deploy --only functions`). Toute la sécurité et le verrou sleepTimer dépendent d'un déploiement manuel. Fix M/L : job CI `@firebase/rules-unit-testing` sur l'émulateur + `firebase deploy --only firestore` dans le workflow de déploiement. Plan détaillé dans TEST-01.
4. **UI-01** (= APP-09) — `Modal` refait `dialogRef.current?.focus()` dans un effet dépendant de `onClose`, recréé à chaque render du parent ; `ActivityPage` se re-rend toutes les 30 s via `useNow` → le focus est **volé à l'input en cours de saisie**. Fix S : séparer l'effet de focus (`[]`) de l'écoute Escape (ou stabiliser `onClose` via ref).

### Thèmes transverses (regroupent beaucoup de findings Moyenne/Basse)

- **Erreurs d'écriture Firestore avalées** : les formulaires font `void repo(...)` sans `catch`, ferment la modale et l'utilisateur croit que c'est enregistré (UI-04, APP-05, APP-06, PAGE-04, APP-12, FN-10). Un helper commun « soumettre + afficher l'erreur + garder la modale ouverte » règle la famille entière.
- **Hooks sans état `loading`/`error`, `onSnapshot` sans callback d'erreur** : « No entries » s'affiche pendant le chargement et pour toujours après une erreur de règle ou d'index (PAGE-07, DATA-05, APP-13, DATA-04). Un petit type `{ data, loading, error }` partagé par les hooks `useRecent*` et `useEntriesInRange`.
- **Timer de sommeil** : plusieurs cas limites autour de start/stop/edit (PAGE-01, PAGE-02, PAGE-03, PAGE-08, PAGE-09, DATA-10, FN-05, FN-09, SEC-11). À traiter en un lot cohérent, avec des tests de règles pour le verrou.
- **Définitions temporelles divergentes** : « total sleep » compté au jour de début dans History mais au jour de réveil ailleurs (LIB-02) ; helpers morts aux définitions contradictoires encore testés (LIB-03) ; âge en mois de 30 jours qui biaise les percentiles WHO (LIB-01, LIB-08) ; semaine figée au montage (UI-02).
- **Infra / CI** : règles + index non déployés (SEC-02), code de branche exécuté avec le SA Firebase (SEC-01), clé SA longue durée (SEC-05), auto-merge Dependabot → prod (SEC-09/TEST-12), CI qui ne bloque ni sur les warnings ni sur la couverture (TEST-04, TEST-05), tests de functions jamais type-checkés (TEST-09).
- **Dette** : 5 repositories + 5 hooks quasi identiques (TEST-13), ~20 exports morts (TEST-14, LIB-03), `plan.md` de 53 Ko à la racine + README vide (SEC-20/TEST-15), `recharts` déclaré mais jamais importé (UI-18), config Firebase dupliquée en dur dans `sw.ts` (FN-12/SEC-12/TEST-07).

### Nuances du consolidateur

- **SEC-01** abaissé Haute → Moyenne : le repo est privé avec deux collaborateurs, donc l'exploitation suppose déjà un accès push. Le fix (checkout de `main` dans ce workflow) reste trivial et recommandé.
- **PAGE-01** abaissé Haute → Moyenne : `updateSleepEntry` reprend volontairement le sommeil quand l'heure de fin est vidée (commentaire explicite dans le code). Il manque la garde d'une heure et un retour utilisateur, pas une perte de données silencieuse.
- **APP-01 / DATA-03** abaissé Haute → Moyenne : le scénario (snapshot vide servi depuis un cache persistant vide, appareil neuf hors ligne) est plausible mais non reproduit ; le garde-fou proposé est peu coûteux.
- **FN-01** : confiance Moyenne sur l'état réel de la console (l'index a pu être créé à la main via le lien d'erreur). Le finding reste valable car l'index doit vivre dans le repo.
- Les findings de catégorie **ux** qui relèvent d'un choix produit (ex. LIB-15 « sieste 19:30–20:10 comptée comme nuit », LIB-05 étiquettes 2 %/98 %) sont listés pour décision, pas comme bugs.

## Vagues d'implémentation proposées

Lots pensés pour être indépendants (un agent par lot, branches/PR séparées), par ordre de valeur.

| Lot | Contenu | Modèle | Findings |
|---|---|---|---|
| A — Notifications & functions | Index composite + payload data-only + idempotence/try-catch par ménage + TTL stop + tokens à la déconnexion | Opus | FN-01, FN-02, FN-03, FN-04, FN-05, FN-06, FN-07, FN-11, FN-14, FN-10 |
| B — Infra CI / sécurité | Déploiement rules+indexes, checkout `main` dans preview-auth-domain, WIF ou SA dédié, pin SHA, `.gitignore`, `--force` | Opus | SEC-02, SEC-01, SEC-05, SEC-09, SEC-13, SEC-16, SEC-17, TEST-09, TEST-04, TEST-05 |
| C — Tests de règles Firestore | Mise en place `@firebase/rules-unit-testing` + scénarios allowlist / membre / wildcard / verrou + garde-fous règles | Opus | TEST-01 (via SEC-02), SEC-06, SEC-10, SEC-11, SEC-04 |
| D — Robustesse UI (erreurs & loading) | Helper de soumission commun, état `{loading,error}` dans les hooks, ErrorBoundary, route 404 / babyId invalide, état vide « aucun enfant » | Opus (design du helper) puis Sonnet | UI-04, APP-05, APP-06, PAGE-04, PAGE-07, DATA-04, APP-02, PAGE-14, APP-07, APP-12 |
| E — Timer de sommeil | Garde d'une heure à l'édition, notes pendant timer, fin < début, instant du clic, écriture par chiffre, stop conditionnel | Opus | PAGE-01, PAGE-02, PAGE-03, PAGE-08, PAGE-09, DATA-10, PAGE-19 |
| F — Modal & a11y | Effet focus séparé, focus trap/restitution, Escape sur menus, aria-label sur div, aria-live | Sonnet | UI-01, APP-10, PAGE-16, PAGE-17, UI-13, APP-11, APP-15 |
| G — Logique temporelle & croissance | Définition unique du « total sleep », âge en mois calendaires, semaine courante vivante, nuit start===end, helpers morts | Opus | LIB-02, LIB-01, LIB-08, UI-02, LIB-09, LIB-03, LIB-07, LIB-10, LIB-11, LIB-12, LIB-13, LIB-05 |
| H — Formulaires & saisie | Validation numérique côté soumission, DurationInput négatif, DateTimeField vidable, GrowthForm arrondi, ReminderSettings écriture debounce | Sonnet | UI-03, UI-10, UI-11, UI-08, UI-06, UI-12, PAGE-12, PAGE-13 |
| I — Données / import-export | Validation des lignes, BOM, formule CSV, compteur import, visites pédiatre dans export/suppression, locks orphelins, docs | Sonnet | DATA-01, DATA-02, DATA-09, DATA-06, DATA-08, SEC-15, DATA-12, DATA-11, DATA-15, APP-03 (Opus) |
| J — Perf & Activity | Fenêtre « depuis hier soir » sans limit(20), listeners redondants, ré-abonnement Trends, mémo trendMetrics | Opus | PAGE-05, PAGE-06, PAGE-15, LIB-14, PAGE-10, UI-05 |
| K — Dette & outillage | Dédup repositories/hooks (L), exports morts, plan.md → docs/, README, recharts, config SW, restoreMocks, mocks partagés, TZ/ tests functions | Sonnet (Opus pour la dédup) | TEST-13, TEST-14, SEC-20, UI-18, FN-12, UI-14, UI-15, TEST-03, TEST-16, TEST-18, LIB-17, DATA-13, DATA-16, DATA-18 |
| L — Couverture | Tests manquants priorisés (handlers functions, hooks, pages pédiatre, CSV limites, DST) | Sonnet | TEST-06, TEST-08, TEST-10, FN-13, LIB-04, DATA-14, PAGE-18, APP-17, UI-16 |

Les findings non cités dans un lot (Basse/Nit restants : SEC-08, SEC-14, SEC-18, SEC-19, SEC-21, FN-08, FN-09, LIB-06, LIB-15, LIB-16, PAGE-11, PAGE-20, PAGE-21, APP-16, APP-19, UI-09, UI-17, TEST-12, TEST-17) sont à prendre à la carte.

## Tableau de validation

Légende : **Fix** = complexité (S < 30 min local, M quelques fichiers, L transverse) ; **Conf.** = confiance de l'agent (H/M/B) ; **Modèle** = suggestion pour l'implémentation ; **Doublons fusionnés** = IDs des autres rapports décrivant le même problème (leur détail peut compléter la solution).

### Haute (4)

| ✔ | ID | Titre | Cat. | Fix | Conf. | Modèle | Doublons fusionnés | Rapport |
|---|---|---|---|---|---|---|---|---|
| [ ] | SEC-02 | `firestore.rules` n'est ni testé ni déployé par la CI : le verrou sleepTimer et tout le contrôle d'accès reposent sur un déploiement manuel | tests | M | H | Opus | TEST-01 | [01-security-infra.md](01-security-infra.md) |
| [ ] | FN-01 | `hasMedicationToday` exige un index composite absent de `firestore.indexes.json` : le rappel médicament échoue (et fait planter tout le tick) | bug | S | M | Sonnet | SEC-07, TEST-02 | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-02 | Rappel médicament affiché deux fois : le SDK FCM affiche la notification `notification{}` ET `onBackgroundMessage` la réaffiche | bug | M | H | Opus | SEC-03 | [02-functions-push.md](02-functions-push.md) |
| [ ] | UI-01 | `Modal` vole le focus à l'input en cours de saisie à chaque re-render du parent | bug | S | H | Sonnet | APP-09 | [07-components.md](07-components.md) |

### Moyenne (40)

| ✔ | ID | Titre | Cat. | Fix | Conf. | Modèle | Doublons fusionnés | Rapport |
|---|---|---|---|---|---|---|---|---|
| [ ] | SEC-01 | `preview-auth-domain.yml` exécute le code de n'importe quelle branche avec le service account Firebase *(sévérité abaissée par le consolidateur : repo privé à 2 collaborateurs : exploitable uniquement par quelqu'un ayant déjà le push ; correctif S malgré tout)* | sécurité | S/M | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-04 | L'allowlist se fonde sur le seul claim `email`, sans `email_verified` ni fournisseur | sécurité | S | M | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-05 | Clé JSON de service account longue durée dans les secrets GitHub (deux workflows) | sécurité | M | H | Opus |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-06 | Aucune validation de schéma dans les règles : champs, types, tailles et `createdBy` arbitraires | sécurité | M | H | Opus |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-08 | Service worker : pas de fallback de navigation, la PWA n'ouvre pas ses routes hors-ligne | robustesse | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | FN-03 | Rappel médicament non idempotent et sans rattrapage : double envoi (DST, retry) ou rappel perdu (tick raté, fenêtre 23:46–23:59) | robustesse | M | H | Opus |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-04 | Aucun `try/catch` par ménage/bébé dans les trois schedulers : une erreur sur un document annule tous les envois du tick | robustesse | M | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-05 | Push de stop du timer avec TTL 60 s : un téléphone hors ligne garde une notification « Sleep Timer » collante et fausse indéfiniment | bug | S | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-06 | Token FCM jamais supprimé à la déconnexion ; `createdAt` écrasé à chaque session, pas de purge des tokens périmés | sécurité | M | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-07 | Chemin d'envoi du rappel médicament dupliqué : pas de nettoyage des tokens invalides, pas de TTL ni d'urgence | maintenabilité | S | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | DATA-01 | Import natif : aucune validation des lignes (erreur opaque ou `NaN` stocké en base) | robustesse | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-02 | BOM UTF-8 non géré : un CSV réenregistré par Excel est refusé, et l'export s'ouvre avec des accents cassés | robustesse | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-04 | Mapping doc → modèle non défensif : un seul document mal formé fige toute la liste sans retour utilisateur | robustesse | M | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | LIB-01 | L'âge en « mois de 30 jours » décale systématiquement les percentiles WHO | bug | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-02 | « Total sleep » n'a pas la même définition dans History (jour de début) et dans Today/Summary/Trends (jour de réveil) | ux | M | H | Opus |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-03 | `aggregations.ts` et `timeline.ts` : huit helpers morts, aux définitions divergentes, encore testés | maintenabilité | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-04 | Tests : aucun cas DST, de nuit non chevauchante, ni de `sleepSegments` direct dans `trendMetrics`, tables WHO vérifiées sur 1/6 | tests | M | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | PAGE-01 | Sauvegarder un sommeil sans heure de fin le remet « en cours » sans la garde d'une heure *(sévérité abaissée par le consolidateur : comportement documenté dans updateSleepEntry (le sommeil reprend volontairement) ; il manque la garde d'une heure et le feedback, pas un bug silencieux de perte de données)* | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-02 | Notes tapées pendant qu'un timer tourne : perdues silencieusement | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-03 | Heure de fin antérieure au début acceptée : durée négative affichée et entrée incohérente persistée | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-04 | Toute erreur d'écriture est traduite en « Another sleep timer is already running. » | robustesse | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-05 | Fenêtre « depuis hier soir » servie par une requête `limit(20)` : troncature silencieuse | bug | M | H | Opus |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-06 | L'écran Activity ouvre 13 à 18 listeners Firestore concurrents, en partie redondants | perf | M | M | Opus |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-07 | Les hooks n'exposent ni chargement ni erreur : « No entries » affiché pendant le chargement et pour toujours après une erreur | robustesse | M | H | Opus | DATA-05, APP-13 | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | APP-01 | Un snapshot « vide depuis le cache » affiche l'onboarding « Create Family » à une famille existante (risque de doublon de household) *(sévérité abaissée par le consolidateur : scénario limité à un appareil neuf hors ligne ; garde-fou proposé peu coûteux)* | robustesse | M | M | Opus | DATA-03 | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-02 | Aucun ErrorBoundary : toute exception de rendu = écran blanc définitif | robustesse | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-03 | Remarks / discussions : écriture du tableau entier → perte silencieuse d'une modification concurrente (2 téléphones) | bug | M | H | Opus |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-04 | ChildPage : le formulaire est réinitialisé à chaque snapshot `babies` (perte des modifications en cours) | bug | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-05 | CreateFamilyPage : aucune gestion d'erreur, bouton bloqué « disabled » pour toujours, household orphelin possible | robustesse | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-07 | Foyer sans enfant (dernier enfant supprimé) : onglets Activity/History/Trends vides, sans état vide ni lien | ux | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | UI-02 | `WeekTimelineChart` fige la « semaine courante » au montage : après minuit dimanche→lundi, les entrées du jour ne sont plus chargées | bug | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-03 | Validation numérique contournée : volumes/poids négatifs ou nuls enregistrés tels quels | bug | M | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-04 | Les 5 formulaires ferment la modale et avalent les erreurs d'écriture Firestore | robustesse | S | H | Sonnet | APP-06 | [07-components.md](07-components.md) |
| [ ] | TEST-03 | `Layout.test.tsx` initialise le vrai SDK Firestore et ouvre un listener gRPC vers `127.0.0.1:8080` — aucune garde n'empêche un test unitaire de toucher Firebase | tests | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-04 | La CI ne bloque pas sur les warnings oxlint (26 aujourd'hui) et des règles clés ne sont pas activées | maintenabilité | M | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-05 | Seuils de couverture déclarés mais jamais appliqués : la CI n'exécute pas `--coverage` | tests | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-06 | Les handlers Cloud Functions (schedulers, triggers, envoi push, nettoyage des tokens) n'ont aucun test — seules les fonctions pures le sont | tests | M | H | Opus |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-08 | Les tests de repositories n'assertent jamais les contraintes de requête (`where`/`orderBy`/`limit`) | tests | M | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-09 | Les tests de `functions/` ne sont jamais type-checkés et tournent sans configuration Vitest (TZ non épinglée) | tests | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-10 | Cartographie des trous de couverture à risque (fichiers sans test ou chemins critiques non exercés) | tests | M | H | Opus |  | [08-tests-tooling.md](08-tests-tooling.md) |

### Basse (66)

| ✔ | ID | Titre | Cat. | Fix | Conf. | Modèle | Doublons fusionnés | Rapport |
|---|---|---|---|---|---|---|---|---|
| [ ] | SEC-09 | Auto-merge Dependabot → déploiement prod sans relecture humaine ; `npm ci` exécute les scripts d'installation | sécurité | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-10 | Un membre peut réécrire `memberUids` (y compris se retirer) ; la liaison uid↔ménage n'a pas de garde-fou | robustesse | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-11 | Un doc `locks/sleepTimer` sans `entryId` verrouille définitivement le timer (règle non récupérable) | robustesse | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-13 | Actions GitHub épinglées par tag majeur, pas par SHA | sécurité | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-14 | Aucun en-tête de sécurité HTTP ni CSP ; clé API non restreinte / pas d'App Check | sécurité | M | M | Opus |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-15 | `deleteBabyWithData` n'efface pas la sous-collection `locks` | maintenabilité | S | H | Sonnet | DATA-07 | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-16 | `.gitignore` n'ignore pas `.env` / `.env.production` | sécurité | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-17 | `firebase deploy --only functions --force` supprime sans confirmation les functions retirées du code | robustesse | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-18 | Les previews Vercel pointent sur la base Firestore de production | robustesse | M | M | Opus |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | FN-08 | Tick du timer : 1440 parcours complets `households → babies → sleepEntries` par jour même sans sommeil en cours, relecture du bébé par entrée, et 4 jobs Cloud Scheduler (3 gratuits) | perf | M | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-09 | Un seul `tag: 'sleep-timer'` par appareil : avec deux bébés (ou deux sommeils) en cours, la notification alterne chaque minute | bug | M | H | Opus |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-10 | `ReminderSettingsModal` : échec de `saveFcmToken` non géré → bouton bloqué sur « requesting » ; état initial ignore une permission déjà accordée | robustesse | S | H | Sonnet | UI-07 | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-11 | `hasMedicationToday` compare le nom exactement alors que l'app considère « vitamine » tout nom commençant par « vitamin » | bug | S | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-12 | Config Firebase codée en dur dans `sw.ts` (dupliquée avec `firebase.ts` qui lit `import.meta.env`) et SW exclu du typecheck | maintenabilité | S | d | Sonnet | SEC-12, TEST-07 | [02-functions-push.md](02-functions-push.md) |
| [ ] | FN-13 | Couverture de tests : toute la logique d'envoi (Firestore + FCM), le SW et les hooks de notification ne sont pas testés ; les tests existants ne couvrent que des helpers purs | tests | L | H | Opus |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | DATA-06 | `importBabyData` compte comme « importés » les sommeils en cours que `importSleepEntries` écarte | bug | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-08 | Les visites pédiatre ne sont ni exportées ni supprimées par « Delete All Data » | ux | M | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-09 | Export CSV : pas de neutralisation des formules (`=`, `+`, `-`, `@`) dans les champs texte | sécurité | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-10 | `stopSleep` écrase un arrêt déjà enregistré depuis l'autre appareil (hors-ligne, cache persistant) | bug | M | M | Opus |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-11 | `downloadCsvFile` révoque l'URL du Blob immédiatement après `click()` | bug | S | M | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-12 | `docs/export-format.md` contredit le code sur le dédoublonnage et oublie les visites | maintenabilité | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-13 | Allowlist e-mail dupliquée en 4 endroits, comparaison sensible à la casse | maintenabilité | S | H | Sonnet | APP-20 | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-14 | Couverture de tests : les requêtes, les docs legacy et les cas limites CSV ne sont pas vérifiés | tests | M | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-15 | Reminders : le nom du médicament sert d'id de document (latent : `/` ou chaîne vide fait jeter `doc()`) | robustesse | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | LIB-05 | Les courbes étiquetées 2 % et 98 % sont en réalité les percentiles 2,3 % / 97,7 % (±2 SD) | bug | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-06 | Axe des durées courtes : mélange de libellés « 40m », « 1h », « 80m » sur un même graphe | ux | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-07 | `sleepSegmentInMetric` évalue la nuit avec l'horloge réelle, pas avec le `now` du calcul | bug | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-08 | `formatAge` : mois de 30 jours (« 12m 5d » au premier anniversaire) et jour en moins entre 00:00 et 01:00 en été | bug | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-09 | Plage nocturne `start === end` acceptée sans validation ; la lib la traite de façon contradictoire | robustesse | S | H | Sonnet | APP-14 | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-10 | `gapSamples` : des sommeils imbriqués/chevauchants gonflent les Wake Windows | robustesse | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-11 | Sommeil en cours : mis en avant dans le calendrier Wake Window / Naps mais exclu des valeurs | ux | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-12 | Calendrier : un sommeil compté sur un jour hors période est quand même coloré en plein (périodes passées) | ux | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-13 | Sommeil terminé avec `durationSeconds` null : affiché « 0m » et exclu des naps / longest / wake windows | robustesse | S | M | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-14 | Perf : `sleepSegments`/`isNightSleep` recalculés sans mémo à chaque rendu de `TrendDetailPage`, avec `Intl.DateTimeFormat` dans la boucle | perf | M | M | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-15 | Définition « nuit = touche la plage nocturne » : une sieste 19:30–20:10 devient un « Nighttime Sleep » | ux | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | PAGE-08 | Démarrage du timer : heure d'ouverture du modal, tronquée à la minute, au lieu de l'instant du clic | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-09 | Édition de l'heure de début d'un timer actif : une écriture Firestore par chiffre tapé, et le compteur saute | ux | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-10 | Au changement de bébé, les hooks affichent brièvement les données du bébé précédent | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-11 | `useActivityVisibility` : JSON non validé (crash possible) et préférence globale malgré une route par bébé | robustesse | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-12 | GrowthDetailPage : « Boys Percentile » affiché pour un bébé dont le sexe est inconnu | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-13 | TrendDetailPage affiche « ↑ 0 mL » quand la variation est non nulle mais arrondie à zéro | bug | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-14 | Écran blanc (`return null`) pour un paramètre d'URL invalide ou sans enfant sélectionné | ux | S | H | Sonnet | APP-08 | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-15 | TrendDetailPage en mode « rolling » : chaque changement d'onglet ré-abonne les 10 listeners | perf | S | M | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-16 | Bannière de sommeil : `aria-live` sur un texte qui change chaque seconde | a11y | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-18 | Tests : comportements à risque non couverts et un test qui fige une perte de données | tests | M | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | APP-10 | Modales : pas de piège de focus, pas de restitution du focus, pas de verrou de scroll ; menu photo sans Escape ni focus | a11y | S | H | Sonnet | UI-19, PAGE-17 | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-11 | Id DOM `visit-date` dupliqué quand « New Visit » est ouvert depuis l'écran d'une visite | a11y | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-12 | Suppression d'une visite : double navigation (snapshot optimiste puis `.then`) et aucune gestion d'erreur | robustesse | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-15 | LoginPage : bouton Google sans état « en cours » (double clic → faux message d'erreur) et `role="alert"` + `aria-live="polite"` contradictoires | ux | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-16 | PhotoCropModal : zoom à la molette fait aussi défiler la page ; orientation EXIF non maîtrisée explicitement | ux | S | d | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | APP-17 | Couverture de tests : chemins d'erreur et cas limites non testés sur l'ensemble du périmètre | tests | M | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | UI-05 | `TimelineGrid.onReachStart` est rappelé à chaque événement scroll dans la zone de départ | perf | S | B | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-06 | `ReminderSettingsModal` écrit dans Firestore à chaque chiffre tapé, y compris des heures intermédiaires fausses | perf | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-08 | Pré-remplissage `GrowthForm` non arrondi : décimales parasites et `stepMismatch` qui bloque la soumission par Entrée | bug | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-09 | `MetricCalendar` : étiquettes d'axe décalées jusqu'à 59 min en mode « rolling » | ux | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-10 | `DurationInput` : valeurs négatives acceptées/affichées, ids DOM codés en dur | robustesse | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-11 | `DateTimeField` : impossible de vider la valeur ; effacer la date la remplace silencieusement par aujourd'hui | ux | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-12 | `GrowthPercentileChart` écarte silencieusement les mesures après 24 mois | ux | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-13 | `aria-label` posés sur des `<div>` sans rôle (ignorés par les lecteurs d'écran) | a11y | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-14 | Aucune restauration automatique des spies entre tests (`restoreMocks` absent) | tests | S | H | Sonnet | TEST-11 | [07-components.md](07-components.md) |
| [ ] | UI-15 | Mocks `useAuth`/`useHousehold` dupliqués dans 14 et 23 fichiers de test | maintenabilité | M | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-16 | Couverture manquante sur les comportements à risque des champs de saisie et des listes | tests | M | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | TEST-12 | Dependabot fusionne automatiquement les minors/patchs de `firebase*`, `react`, `vite` alors que la suite ne touche jamais le vrai SDK | robustesse | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-13 | Duplication structurelle : 5 repositories d'entrées quasi identiques, 5 hooks `useRecent*Entries` identiques, et leurs tests ×6 | maintenabilité | L | H | Opus |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-14 | Code mort et exports « test-only » : ~20 symboles exportés sans aucun appelant en production | maintenabilité | S | u | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-16 | Bruit `stderr` toléré dans la suite (SDK Firestore, `console.error` attendus, « No routes matched », jsdom navigation) | tests | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |

### Nit (17)

| ✔ | ID | Titre | Cat. | Fix | Conf. | Modèle | Doublons fusionnés | Rapport |
|---|---|---|---|---|---|---|---|---|
| [ ] | SEC-19 | Cache Firestore persistant non vidé à la déconnexion | sécurité | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-20 | README vide | maintenabilité | S | H | Sonnet | TEST-15 | [01-security-infra.md](01-security-infra.md) |
| [ ] | SEC-21 | Petits points CI/config | maintenabilité | S | H | Sonnet |  | [01-security-infra.md](01-security-infra.md) |
| [ ] | FN-14 | Redondance et nommage trompeur : `requestSleepTimerNotificationPermission().then(() => registerPush(uid))` copié 3 fois, y compris pour les vaccins, alors que `registerPush` demande déjà la permission | maintenabilité | S | H | Sonnet |  | [02-functions-push.md](02-functions-push.md) |
| [ ] | DATA-16 | `HouseholdContext` : résabonnement aux bébés à chaque snapshot du foyer, `error` jamais effacé, `selectBaby` non mémoïsé | perf | S | H | Sonnet | APP-18 | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-17 | AuthContext : fermeture volontaire de la popup affichée comme erreur, `logout`/`signOut` sans gestion d'erreur | ux | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | DATA-18 | Types de modèles trompeurs : `FcmToken.createdAt: string` alors qu'un `Timestamp` est écrit ; `FcmToken`/`Reminder.id` jamais relus | maintenabilité | S | H | Sonnet |  | [03-data-layer.md](03-data-layer.md) |
| [ ] | LIB-16 | Nit : pluriels figés (« 1 diapers », « 1 sessions ») dans la headline d'un jour | ux | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | LIB-17 | Nit : parsing `HH:mm` dupliqué en 6 endroits | maintenabilité | S | H | Sonnet |  | [04-lib-logic.md](04-lib-logic.md) |
| [ ] | PAGE-19 | « Start Timer » dans le modal d'édition ignore les notes/fin modifiées ; `onResumed` avant confirmation | ux | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-20 | Lignes des cartes clés par index, et période de Trends non propagée au détail | maintenabilité | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | PAGE-21 | Lien « Entries before 20:00 » ouvre History en vue graphique hebdomadaire, pas la liste du jour | ux | S | H | Sonnet |  | [05-pages-tracking.md](05-pages-tracking.md) |
| [ ] | APP-19 | `newItemId` dépend de `crypto.randomUUID` (contexte sécurisé uniquement) | robustesse | S | H | Sonnet |  | [06-app-account-pediatrician.md](06-app-account-pediatrician.md) |
| [ ] | UI-17 | `fakeSnapshot` ne modélise que `docs` : un `snapshot.empty`/`size` serait silencieusement `undefined` | tests | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | UI-18 | Dépendance `recharts` déclarée mais jamais importée | maintenabilité | S | H | Sonnet |  | [07-components.md](07-components.md) |
| [ ] | TEST-17 | `tsconfig.app.json` : `strict` implicite (défaut TS 7) et `noUncheckedIndexedAccess` absent | maintenabilité | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |
| [ ] | TEST-18 | Performance de la suite : jsdom instancié 86 fois (53 % des 78 s), y compris pour ~30 fichiers de `src/lib` purement algorithmiques | perf | S | H | Sonnet |  | [08-tests-tooling.md](08-tests-tooling.md) |