# Revue SÉCURITÉ & INFRA/CONFIG — baby-tracker

Périmètre lu en entier : `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc`, `.github/workflows/*.yml`, `.github/dependabot.yml`, `vercel.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `package.json`, `.env.example`, `.env.live`, `.gitignore`, `scripts/*.mjs`, `src/lib/firebase.ts`, `src/lib/paths.ts`, `src/main.tsx`, `src/sw.ts`, `public/`, `README.md`, plus (croisement) `src/repositories/*.ts`, `src/contexts/AuthContext.tsx`, `src/contexts/HouseholdContext.tsx`, `src/components/Layout.tsx`, `src/lib/babyExport.ts`, `src/lib/firestoreBatch.ts`, `src/lib/messaging.ts`, `src/lib/pushRegistration.ts`, `src/lib/foregroundPush.ts`, `src/lib/vaccineNotification.ts`, `src/lib/sleepTimerNotification.ts`, `src/lib/photoExport.ts`, `functions/src/{index,tokens,push,sleepTimer}.ts`, `docs/notifications-setup.md`, en-tête Status de `plan.md`.

Vérifications faites hors lecture : `tsc` 7.0.2 applique bien `strict` par défaut à `tsconfig.app.json` (sondé avec un fichier de test dans le scratchpad → `TS18047`/`TS7006` levées, donc pas de finding sur l'absence de `"strict": true`) ; code source de `@firebase/messaging` SW (`node_modules/@firebase/messaging/dist/esm/index.sw.esm.js:1393-1428`) lu pour le finding SEC-03 ; `git ls-files` + historique : aucun secret commité (`.env.live` ne contient qu'un flag, `.env.local` est ignoré via `*.local`).

---

### [SEC-01] `preview-auth-domain.yml` exécute le code de n'importe quelle branche avec le service account Firebase
- **Sévérité** : Haute
- **Catégorie** : sécurité
- **Fichier(s)** : `.github/workflows/preview-auth-domain.yml:5,19-30`, `scripts/authorize-preview-domain.mjs:20-45`
- **Constat** : Le workflow se déclenche sur `deployment_status` (ligne 5), événement émis par Vercel pour **toute** branche déployée en preview. `actions/checkout@v7` (ligne 19) sans `ref` checkout `github.sha`, qui pour `deployment_status` est le commit **de la branche déployée**. Le job s'authentifie ensuite avec `secrets.FIREBASE_SERVICE_ACCOUNT` (ligne 24-25), fabrique un access token (`gcloud auth print-access-token`, ligne 28) et le passe en env à `node scripts/authorize-preview-domain.mjs` — c'est-à-dire la version du script **contenue dans la branche**. Toute branche poussée sur le repo (collaborateur, agent Claude Code poussant `claude/*` — c'est le mode de travail de ce repo d'après `git log` —, ou PR Dependabot si un package compromis pouvait modifier le script, ce qui n'est pas le cas mais un collaborateur oui) peut donc remplacer le script par un exfiltrateur du token du SA (qui a au minimum les droits de déployer des Cloud Functions et de modifier la config Identity Toolkit).
- **Impact** : Une branche malveillante ou issue d'une injection de prompt dans une session Claude → preview Vercel → le workflow exécute son script avec un token du service account prod → prise de contrôle des Cloud Functions / Auth du projet `baby-tracker-c8fd2` (les pushes FCM, l'allowlist de domaines OAuth, etc.).
- **Solution proposée** : (1) Ne jamais exécuter du code de la branche dans ce workflow : `actions/checkout@v7` avec `ref: main` (ou `ref: ${{ github.event.repository.default_branch }}`), de sorte que `scripts/authorize-preview-domain.mjs` provienne toujours de `main`. (2) Restreindre le job aux previews émis depuis des commits du repo (`github.event.deployment.creator.login == 'vercel[bot]'` et `github.event.deployment_status.creator`…) et/ou vérifier côté Vercel que les previews ne se déploient que pour les membres. (3) Réduire la surface du secret : un SA dédié au workflow avec le seul rôle `roles/firebaseauth.admin` (pas celui qui déploie les functions), et idéalement Workload Identity Federation (voir SEC-05). (4) Déplacer la regex `PREVIEW_HOST` côté workflow (`if: startsWith(github.event.deployment_status.environment_url, 'https://baby-tracker-')`) en plus de la vérification dans le script. Test : aucun test automatisé possible du workflow ; ajouter un test unitaire de `nextAuthorizedDomains` dans `scripts/` (actuellement exporté sans test) pour protéger la logique de rotation.
- **Complexité du fix** : S (checkout `ref: main`) ; M pour le SA dédié / WIF
- **Confiance** : Haute sur le mécanisme (sémantique documentée de `deployment_status` + checkout par défaut) ; Moyenne sur l'exploitabilité réelle (dépend du réglage Vercel « deploy previews for all/members » et des rôles IAM du SA, non vérifiables statiquement)

### [SEC-02] `firestore.rules` n'est ni testé ni déployé par la CI : le verrou sleepTimer et tout le contrôle d'accès reposent sur un déploiement manuel
- **Sévérité** : Haute
- **Catégorie** : tests
- **Fichier(s)** : `.github/workflows/ci.yml`, `.github/workflows/deploy-functions.yml:4-9,31`, `firestore.rules:30-66`, `docs/notifications-setup.md:30`
- **Constat** : Aucun test n'exerce `firestore.rules` (grep `rules-unit-testing` : rien dans `src/`, `functions/`, `package.json`) alors que le fichier contient une logique non triviale : wildcard `{entryCollection}` avec exclusion, `getAfter()` sur le verrou, `isFree()` croisant `exists()`/`get()` (lignes 30-62). Les tests de `src/repositories/sleepEntries.test.ts:66-75` vérifient seulement que le client écrit le lock dans le batch, pas que les règles refusent un second timer. Par ailleurs `deploy-functions.yml` ne déploie que `--only functions` (ligne 31) et n'écoute que `functions/**` et `firebase.json` (lignes 6-8) ; les règles sont déployées à la main (`docs/notifications-setup.md:30`). Le commit `d417488` (« only one sleep can run at a time ») a ajouté le lock aux règles ET au client : si les règles n'ont pas été redéployées, le client écrit `locks/sleepTimer` qui est refusé par l'ancienne règle (ou, si l'ancienne règle était un wildcard permissif, le lock n'est pas appliqué) — dans les deux cas le comportement prod diverge du code.
- **Impact** : Une régression dans les règles (ex. ouvrir `locks` dans le wildcard, oublier `isAllowedEmail()` dans une nouvelle match) part en prod sans filet ; ou inversement une règle non déployée casse le démarrage de sieste (« Another sleep timer is already running » en boucle) sans qu'aucun test ni pipeline ne le signale.
- **Solution proposée** : (1) Ajouter `@firebase/rules-unit-testing` en devDependency et un job CI `rules` : `npx firebase emulators:exec --only firestore "vitest run rules"` avec des tests dans `rules/*.test.ts` couvrant au minimum : email non allowlisté refusé partout ; uid hors `memberUids` refusé ; écriture `sleepEntries` running sans lock refusée ; batch sleep+lock accepté ; second batch avec lock pointant vers un sleep running refusé ; lock libéré après `endedAt != null` ou suppression ; écriture directe de `locks/sleepTimer` via wildcard refusée ; `users/{uid}/fcmTokens` d'un autre uid refusé. (2) Créer `.github/workflows/deploy-firestore.yml` (ou étendre `deploy-functions.yml`) : `on.push.paths: [firestore.rules, firestore.indexes.json]` → `firebase deploy --only firestore:rules` (voir SEC-07 avant d'ajouter `firestore:indexes`). (3) Déclencher les tests de règles aussi dans `ci.yml` sur PR.
- **Complexité du fix** : M
- **Confiance** : Haute

### [SEC-03] `sw.ts` affiche deux fois les pushes de type `notification` (rappel médicament)
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/sw.ts:76-78`, `functions/src/index.ts:50-56`
- **Constat** : `functions/src/index.ts:50-56` envoie le rappel médicament avec une clé `notification` (title/body), pas en data-only. Dans le SDK (`@firebase/messaging/dist/esm/index.sw.esm.js:1413-1422`), `onPush` fait d'abord `if (internalPayload.notification) await showNotification(...)` **puis** appelle `onBackgroundMessageHandler(payload)`. Le handler de `sw.ts` tombe dans la branche générique lignes 76-78 et appelle `showNotification(payload.notification.title, ...)` une seconde fois, sans `tag` → deux notifications identiques (la première avec l'icône par défaut du SDK, la seconde avec `icon-192`/`badge-96`).
- **Impact** : Chaque rappel « Vitamin D hasn't been given yet today » apparaît en double sur chaque téléphone en arrière-plan.
- **Solution proposée** : Soit supprimer le fallback lignes 76-78 (le SDK affiche déjà les pushes `notification`), soit — préférable pour garder icône/badge/tag cohérents — passer `sendMedicationReminder` en data-only comme les autres (`sendToHousehold(householdRef, { type: 'medication-reminder', medicationName }, ttl)`) et traiter `data.type === 'medication-reminder'` dans `sw.ts` avec `tag: \`medication-${medicationName}\``. Test : dans `functions/src/index.test.ts`, vérifier que le payload envoyé ne contient pas `notification` ; côté `src/lib`, extraire la construction des options dans un helper testable (`medicationNotification(name)`) comme `vaccineNotification`.
- **Complexité du fix** : S
- **Confiance** : Haute (code du SDK lu)

### [SEC-04] L'allowlist se fonde sur le seul claim `email`, sans `email_verified` ni fournisseur
- **Sévérité** : Moyenne
- **Catégorie** : sécurité
- **Fichier(s)** : `firestore.rules:6-9`, `src/contexts/AuthContext.tsx:28,54`
- **Constat** : `isAllowedEmail()` (lignes 6-9) accepte tout token dont `request.auth.token.email` est dans la liste ; `AuthContext.tsx:54` fait de même côté client. Rien ne vérifie `email_verified` ni `firebase.sign_in_provider == 'google.com'`. Le projet a historiquement utilisé Email/Password (plan.md, point 5) et le code prod embarque encore `signInWithEmailAndPassword` (`AuthContext.tsx:87`) ; si le fournisseur Email/Password (ou un autre fournisseur OAuth à email non vérifié) reste activé dans la console, la sécurité repose uniquement sur la protection « one account per email » de Firebase Auth et sur le fait que le compte Google existe déjà. C'est une défense à un seul étage pour la totalité des données.
- **Impact** : Si un jour le compte Firebase Auth est supprimé/recréé, ou si un fournisseur à email non vérifié est activé, un tiers peut créer un compte portant `amandineandcorentin@gmail.com` (non vérifié) via l'API Identity Toolkit (clé publique) et obtenir un token qui passe `isAllowedEmail()`.
- **Solution proposée** : Dans `firestore.rules` : `return request.auth != null && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider == 'google.com' && request.auth.token.email in [...]` (pour l'émulateur, le seed met `emailVerified: true` ; relâcher `sign_in_provider` sous un commentaire si les tests émulateur utilisent `password`, ou accepter `in ['google.com','password']` uniquement dans une copie `firestore.rules` de test). Côté client, `AuthContext.tsx:54` : refuser aussi `!nextUser.emailVerified`. Dans la console : désactiver le fournisseur Email/Password en prod. Test : règles (SEC-02) avec un token `{ email: allowlisté, email_verified: false }` → refusé.
- **Complexité du fix** : S
- **Confiance** : Moyenne (l'état des fournisseurs activés en console n'est pas vérifiable statiquement)

### [SEC-05] Clé JSON de service account longue durée dans les secrets GitHub (deux workflows)
- **Sévérité** : Moyenne
- **Catégorie** : sécurité
- **Fichier(s)** : `.github/workflows/deploy-functions.yml:27-28`, `.github/workflows/preview-auth-domain.yml:24-25`
- **Constat** : `google-github-actions/auth@v3` est utilisé avec `credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}` : une clé privée non expirante, partagée par deux workflows aux besoins très différents (déployer des functions vs. modifier `authorizedDomains`). Toute fuite (log, SEC-01, compromission du compte GitHub) donne un accès permanent jusqu'à rotation manuelle.
- **Impact** : Exfiltration = contrôle durable du projet Firebase ; pas de révocation automatique.
- **Solution proposée** : Passer à Workload Identity Federation : `permissions: id-token: write` sur les jobs, `google-github-actions/auth@v3` avec `workload_identity_provider` + `service_account`, pool WIF restreint à `repository == cpeuvrel/baby-tracker` et `ref == refs/heads/main` pour le déploiement. Créer deux SA : `gh-deploy-functions` (Cloud Functions Developer + Service Account User + Cloud Build) et `gh-auth-domains` (`roles/firebaseauth.admin` uniquement). Supprimer la clé JSON après migration.
- **Complexité du fix** : M (config GCP + 2 fichiers YAML)
- **Confiance** : Haute

### [SEC-06] Aucune validation de schéma dans les règles : champs, types, tailles et `createdBy` arbitraires
- **Sévérité** : Moyenne
- **Catégorie** : sécurité
- **Fichier(s)** : `firestore.rules:17-20,27,33-36,60-65,70-72`, `src/repositories/babies.ts:61-66`, `src/lib/photoExport.ts:3-4`, `src/repositories/fcmTokens.ts:4-9`
- **Constat** : Toutes les `allow write` sont de pures vérifications d'identité. Conséquences concrètes : (a) `babies` (règle ligne 27) accepte n'importe quel `photoDataUrl` jusqu'à la limite Firestore de 1 MiB alors que le client produit un JPEG 320×320 (~20-40 Ko, `photoExport.ts:3-4`) — chaque `subscribeToBabies` renvoie tous les bébés avec leurs photos à chaque changement ; (b) `createdBy` n'est jamais contraint à `request.auth.uid` ; (c) `occurredAt`/`startedAt`/`endedAt` peuvent être des strings ou absents (un `sleepEntries` sans champ `endedAt` fait planter `startsRunning()` → refusé, OK, mais un `endedAt` string passe et casse `where('endedAt','==',null)` + `nullableTimestampToIso`) ; (d) `households.create` accepte des champs arbitraires et un `memberUids` non-liste (qui fait ensuite échouer `in` → le ménage devient illisible) ; (e) `users/{uid}/fcmTokens/{tokenId}` n'impose pas `tokenId == request.resource.data.token`, alors que `functions/src/tokens.ts:16` utilise l'id de doc comme token.
- **Impact** : Avec un seul compte allowlisté, le risque est surtout la défense en profondeur (session volée/XSS/bug client) : un doc bébé de 1 Mio multiplié par les listeners, des entrées impossibles à lire par le client (TypeError sur `toDate()` dans `timestampToIso`), un ménage auto-verrouillé.
- **Solution proposée** : Ajouter des fonctions de validation par collection, appelées dans chaque `allow create/update`, ex. pour `babies` : `request.resource.data.keys().hasOnly(['name','birthDate','sex','nighttimeHours','photoDataUrl']) && request.resource.data.name is string && request.resource.data.name.size() <= 80 && (!('photoDataUrl' in request.resource.data) || request.resource.data.photoDataUrl == null || (request.resource.data.photoDataUrl is string && request.resource.data.photoDataUrl.size() < 150000))`. Pour les entrées : `createdBy == request.auth.uid` à la création, `occurredAt is timestamp`, `notes.size() <= 2000`. Pour `households` : `memberUids is list && memberUids.size() <= 4`. Pour `fcmTokens` : `tokenId == request.resource.data.token`. Tests : règles (SEC-02) avec un payload hors schéma refusé par collection. Attention à `updateDoc` partiels (ex. `updateSleepStart`) : valider sur `request.resource.data` (état fusionné), ce qui fonctionne.
- **Complexité du fix** : M
- **Confiance** : Haute

### [SEC-07] `firestore.indexes.json` vide alors que `checkMedicationReminders` exige un index composite ; un futur `deploy --only firestore:indexes` supprimerait l'index créé en console
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `firestore.indexes.json:1-4`, `functions/src/index.ts:33-38`, `firebase.json:4`
- **Constat** : La requête `.where('name','==',medicationName).where('givenAt','>=',…)` (égalité + inégalité sur deux champs) nécessite un index composite `medicationEntries(name ASC, givenAt ASC)`. `firestore.indexes.json` est `{ "indexes": [] }`. Deux cas : soit l'index n'existe pas et la fonction échoue à chaque tick avec `FAILED_PRECONDITION` (rappel jamais envoyé) ; soit il a été créé à la main via le lien d'erreur et le fichier est désynchronisé — `firebase deploy --only firestore` (ou `firestore:indexes`) **supprime** les index absents du fichier (avec `--force`/`--non-interactive`, sans confirmation). Les autres requêtes (`endedAt == null`, `date` range sur un seul champ, `memberUids array-contains`) n'ont pas ce besoin.
- **Impact** : Rappel médicament silencieusement cassé, ou destruction de l'index le jour où l'on ajoute `firestore` au déploiement CI (SEC-02).
- **Solution proposée** : Déclarer l'index dans `firestore.indexes.json` : `{"collectionGroup":"medicationEntries","queryScope":"COLLECTION","fields":[{"fieldPath":"name","order":"ASCENDING"},{"fieldPath":"givenAt","order":"ASCENDING"}]}` ; lancer `firebase firestore:indexes` pour exporter l'état console actuel et le comparer ; puis seulement inclure `firestore:indexes` dans le workflow de déploiement. Test : dans le job règles/émulateur (SEC-02), exécuter la requête de `hasMedicationToday` contre l'émulateur avec le fichier d'index chargé (l'émulateur signale les index manquants dans `firestore-debug.log`).
- **Complexité du fix** : S
- **Confiance** : Haute sur le besoin d'index ; Moyenne sur l'état réel de la console

### [SEC-08] Service worker : pas de fallback de navigation, la PWA n'ouvre pas ses routes hors-ligne
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/sw.ts:30`, `vite.config.ts:31-33`, `src/lib/firebase.ts:24-26`
- **Constat** : `precacheAndRoute(self.__WB_MANIFEST)` (ligne 30) ne sert que les URL précachées (`/index.html`, `/` via `directoryIndex`). Aucune `NavigationRoute`/`createHandlerBoundToURL('/index.html')` n'est enregistrée. Hors connexion, ouvrir l'app installée sur `/history`, `/account/...` ou depuis une notification (`/?timer=sleep` passe, `/account/pediatrician/visits/<id>` échoue) donne une erreur réseau, alors que `firebase.ts:24-26` active `persistentLocalCache` justement pour fonctionner hors-ligne. De plus `globPatterns` (`vite.config.ts:32`) exclut `woff2` : la police Nunito n'est pas précachée.
- **Impact** : Réouverture de l'app en mode avion depuis l'écran d'accueil (dernière route mémorisée) ou depuis une notification vaccin → page d'erreur Chrome au lieu de l'app avec le cache Firestore.
- **Solution proposée** : Dans `sw.ts` : `import { registerRoute, NavigationRoute } from 'workbox-routing'` ; `import { createHandlerBoundToURL } from 'workbox-precaching'` ; après `precacheAndRoute` : `registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/__\//] }))`. Ajouter `woff2` à `globPatterns` et `workbox-routing` aux dépendances. Test : `src/sw.ts` est exclu de la couverture ; au minimum un test unitaire du `denylist`/regex n'apporte rien — tester manuellement (DevTools → Offline → recharger `/history`).
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-09] Auto-merge Dependabot → déploiement prod sans relecture humaine ; `npm ci` exécute les scripts d'installation
- **Sévérité** : Basse
- **Catégorie** : sécurité
- **Fichier(s)** : `.github/workflows/ci.yml:41-80`, `.github/dependabot.yml:16-18`
- **Constat** : Les PR Dependabot minor/patch sont fusionnées automatiquement sur `main` (ligne 72) dès que lint/tests/build passent, ce qui déclenche le déploiement Vercel prod et (pour `functions/`) `deploy-functions.yml`. Le cooldown de 3 jours (dependabot.yml:16-18) limite les paquets détournés rapidement dépubliés, mais pas les compromissions détectées plus tard ; et `npm ci` (ci.yml:20,36) exécute les scripts `postinstall` des dépendances dans un runner qui, pour le job `dependabot`, n'a pas de secrets mais, pour `deploy-functions.yml:26`, a le SA. L'app est perso et le ratio bénéfice/risque est acceptable, d'où Basse.
- **Impact** : Une dépendance compromise publiée > 3 jours avant la découverte arrive en prod (bundle client qui a accès au token Firebase de l'utilisateur) sans qu'un humain regarde le diff.
- **Solution proposée** : (1) `npm ci --ignore-scripts` dans les jobs qui n'en ont pas besoin (vérifier que `esbuild`/`@firebase/*` fonctionnent — esbuild ≥ 0.18 n'a plus de postinstall nécessaire via optionalDependencies). (2) Limiter l'auto-merge aux `update-type == 'version-update:semver-patch'` et laisser les minor en revue, ou au moins exiger un `cooldown.default-days: 7`. (3) Activer la protection de branche `main` « require status checks » pour que `gh pr merge` ne puisse pas court-circuiter la CI.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-10] Un membre peut réécrire `memberUids` (y compris se retirer) ; la liaison uid↔ménage n'a pas de garde-fou
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `firestore.rules:17-20`, `src/repositories/households.ts:7-13,20-24`, `functions/src/tokens.ts:11-17`
- **Constat** : `allow update` sur `/households/{id}` (ligne 18-19) ne contraint pas `request.resource.data.memberUids` : un membre peut ajouter n'importe quel uid (le fan-out FCM `tokens.ts:14-17` lira alors les tokens de cet uid — inoffensif car l'uid étranger ne peut pas écrire de tokens, cf. règle `users`), **ou se retirer lui-même**, rendant le ménage et tout son sous-arbre inaccessibles (aucune règle admin). `allow delete` sur le ménage laisse de même les sous-collections `babies/**` orphelines et illisibles (`isHouseholdMember` → `get()` d'un doc absent → erreur → refus). Aucun écran n'écrit `memberUids` aujourd'hui (grep), donc self-DoS uniquement. À noter aussi : si le compte Firebase Auth est supprimé/recréé (nouvel uid), `subscribeToHouseholdForUser` ne trouve rien et l'app propose « Create Family » → un second ménage, l'ancien devient invisible.
- **Impact** : Données verrouillées par erreur (console, bug client) sans chemin de récupération côté app.
- **Solution proposée** : Dans `households.update` : `request.resource.data.memberUids == resource.data.memberUids` (immuable depuis le client ; un ajout de membre passerait par une Cloud Function ou la console) ou a minima `request.auth.uid in request.resource.data.memberUids`. Interdire `delete` du ménage côté client (`allow delete: if false`) puisqu'aucun écran ne le fait. Test : règles (SEC-02) — update retirant son propre uid → refusé.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-11] Un doc `locks/sleepTimer` sans `entryId` verrouille définitivement le timer (règle non récupérable)
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `firestore.rules:49-64`
- **Constat** : `isFree()` construit `lockedEntryPath()` avec `resource.data.entryId` (ligne 51). Si le lock existe sans ce champ (ex. `{}` écrit par un client bogué ou depuis la console — rien ne l'interdit puisque la règle ne valide pas le contenu quand `isFree()`), l'évaluation lève une erreur ; `error || (request.resource != null && …)` reste une erreur pour toute écriture ET pour la suppression (`request.resource == null`). Plus aucune écriture/suppression du lock n'est possible depuis le client, donc plus aucun démarrage de sieste pour ce bébé, jusqu'à intervention Admin SDK/console.
- **Impact** : « Another sleep timer is already running » en permanence après un doc lock mal formé.
- **Solution proposée** : (1) Valider le lock à l'écriture : `request.resource.data.keys().hasOnly(['entryId']) && request.resource.data.entryId is string`. (2) Rendre `isFree()` tolérant : `resource == null || !('entryId' in resource.data) || !exists(lockedEntryPath()) || get(lockedEntryPath()).data.endedAt != null`. Test : règles (SEC-02) — lock `{}` préexistant → delete accepté, set `{entryId:'x'}` accepté.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-12] Config Firebase dupliquée en dur dans `sw.ts` (divergence env/preview/émulateur)
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/sw.ts:34-41`, `src/lib/firebase.ts:10-17`, `vitest.config.ts:13-22`
- **Constat** : Le service worker instancie Firebase avec les valeurs prod en dur (projectId, senderId, appId, apiKey) alors que l'app lit `import.meta.env.VITE_*`. Avec `vite-plugin-pwa` 1.3.0 le SW est bundlé par Vite (`strategies: 'injectManifest'`), donc `import.meta.env` y est disponible (le d.ts du plugin documente `import.meta.env.MODE/DEV/PROD`). Résultat : en dev émulateur ou si le projet/appId change, le SW parle toujours au projet prod ; et deux sources de vérité à maintenir. Exposer la clé API web côté client est normal (pas de finding).
- **Impact** : Token FCM généré pour un `appId`/`senderId` différent de celui de la page si les env Vercel changent → pushes jamais reçus, sans erreur visible.
- **Solution proposée** : Dans `sw.ts`, remplacer le littéral par `initializeApp({ apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: …, projectId: …, storageBucket: …, messagingSenderId: …, appId: … })` (ou importer un `src/lib/firebaseConfig.ts` partagé sans dépendance DOM, que `firebase.ts` importe aussi). Vérifier le bundle `dist/sw.js` après build.
- **Complexité du fix** : S
- **Confiance** : Moyenne (sur la substitution `import.meta.env` dans le SW, documentée par le plugin mais non exécutée ici)

### [SEC-13] Actions GitHub épinglées par tag majeur, pas par SHA
- **Sévérité** : Basse
- **Catégorie** : sécurité
- **Fichier(s)** : `.github/workflows/ci.yml:15-16,30-31,54`, `.github/workflows/deploy-functions.yml:20-21,27`, `.github/workflows/preview-auth-domain.yml:19-26`
- **Constat** : `actions/checkout@v7`, `actions/setup-node@v7`, `google-github-actions/auth@v3`, `setup-gcloud@v3`, `dependabot/fetch-metadata@v3` : un tag mobile peut être réécrit (cas tj-actions 2025). Les workflows qui manipulent le SA (SEC-05) et qui fusionnent sur `main` sont concernés. Dependabot `github-actions` est bien configuré (dependabot.yml:40-45), ce qui rend le pin par SHA peu coûteux (il met à jour le SHA + commentaire de version).
- **Impact** : Compromission d'une action tierce → exécution arbitraire avec `contents: write` (job dependabot) ou le SA Firebase.
- **Solution proposée** : Épingler chaque `uses:` sur le SHA complet avec le tag en commentaire (`uses: actions/checkout@<sha> # v7.x.y`), et activer dans les settings du repo « Require actions to be pinned to a full-length commit SHA ».
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-14] Aucun en-tête de sécurité HTTP ni CSP ; clé API non restreinte / pas d'App Check
- **Sévérité** : Basse
- **Catégorie** : sécurité
- **Fichier(s)** : `vercel.json:1-3`, `index.html:1-14`, `src/lib/firebase.ts:10-17`
- **Constat** : `vercel.json` ne contient qu'un rewrite SPA ; pas de `headers` (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). `index.html` n'a pas de `<meta http-equiv="Content-Security-Policy">`. L'app affiche des `data:` URL (photos) et des chaînes utilisateur (notes, noms) via React (échappées) ; le risque XSS est faible mais une CSP limiterait l'impact d'une dépendance compromise (SEC-09) qui, elle, s'exécute avec le token Firebase. Côté Firebase, rien n'indique que la clé API soit restreinte (APIs Identity Toolkit/Firestore/FCM + referrers) ni qu'App Check soit activé — non vérifiable statiquement.
- **Impact** : Un script injecté peut exfiltrer toutes les données du ménage vers un domaine tiers sans être bloqué.
- **Solution proposée** : Ajouter dans `vercel.json` : `"headers": [{"source": "/(.*)", "headers": [{"key":"Content-Security-Policy","value":"default-src 'self'; script-src 'self' https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com; frame-src https://baby-tracker-c8fd2.firebaseapp.com https://accounts.google.com; img-src 'self' data: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self'; manifest-src 'self'"},{"key":"X-Content-Type-Options","value":"nosniff"},{"key":"Referrer-Policy","value":"strict-origin-when-cross-origin"},{"key":"Permissions-Policy","value":"camera=(self), geolocation=()"}]}]` — à valider en preview avec `Content-Security-Policy-Report-Only` d'abord (popup Google + Firestore WebChannel). Dans la console GCP : restreindre la clé aux 4 APIs utilisées ; envisager App Check reCAPTCHA v3 (`initializeAppCheck` dans `firebase.ts`, `enforce` sur Firestore).
- **Complexité du fix** : M (itérations CSP)
- **Confiance** : Moyenne (liste exacte des origines à affiner en test)

### [SEC-15] `deleteBabyWithData` n'efface pas la sous-collection `locks`
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/lib/babyExport.ts:77-85`, `src/lib/babyDelete.test.ts:26-37`, `src/lib/paths.ts:55-57`
- **Constat** : Le commentaire ligne 74-76 explique que les sous-collections doivent être vidées avant de supprimer le bébé, mais la liste (lignes 60-68 + 80-81) oublie `locks` (`sleepTimerLockDoc`, `paths.ts:55-57`), ajoutée au commit `d417488`. Le test `babyDelete.test.ts:26-37` fige la liste sans `locks`. Le doc `households/{h}/babies/{b}/locks/sleepTimer` survit donc sous un parent supprimé (invisible dans l'app, visible en console, non facturé significativement). La règle `locks` autorise la suppression quand le lock pointe vers une entrée supprimée (`!exists()`), donc le nettoyage est possible depuis le client.
- **Impact** : Fuite de documents orphelins ; incohérence avec la promesse du commentaire.
- **Solution proposée** : Ajouter `deleteDoc(sleepTimerLockDoc(householdId, babyId))` (ignorer `not-found`) après `deleteAllBabyData` dans `deleteBabyWithData`, ou traiter `collection(..., 'locks')` via `batchDeleteAll` en exposant `locksCollection()` dans `paths.ts`. Mettre à jour `babyDelete.test.ts` pour attendre `locks` (ou le path du lock) dans `deletedPaths`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-16] `.gitignore` n'ignore pas `.env` / `.env.production`
- **Sévérité** : Basse
- **Catégorie** : sécurité
- **Fichier(s)** : `.gitignore:13`, `.env.example`, `.env.live`
- **Constat** : Seul `*.local` est ignoré (`git check-ignore` confirme que `.env` et `.env.production` ne le sont pas). Vite charge aussi `.env`, `.env.production`, `.env.development`. `docs/notifications-setup.md:21` demande de mettre la clé VAPID dans `.env.local` — correct — mais un `.env` créé par réflexe serait commité (les valeurs Firebase web sont publiques, la VAPID publique aussi, donc impact limité ; d'où Basse).
- **Impact** : Commit accidentel d'un fichier d'env, et confusion de priorité entre `.env.live` (commité) et `.env`.
- **Solution proposée** : Ajouter à `.gitignore` : `.env`, `.env.*`, puis `!.env.example`, `!.env.live`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-17] `firebase deploy --only functions --force` supprime sans confirmation les functions retirées du code
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `.github/workflows/deploy-functions.yml:29-31`
- **Constat** : Le commentaire (lignes 29-30) justifie `--force` par la politique de nettoyage des images de conteneur, mais `--force` en déploiement de functions a un second effet : il accepte automatiquement la suppression de toute function déployée mais absente du build courant (renommage, export oublié dans `functions/src/index.ts`). Combiné à un déploiement automatique sur chaque push `main` touchant `functions/**`, un simple oubli d'`export` dans `index.ts:94-95` retire `tickSleepTimerNotifications` ou `askVaccinePurchase` de prod silencieusement.
- **Impact** : Perte d'un scheduler prod (plus de ticks/rappels) sans échec de pipeline.
- **Solution proposée** : Remplacer `--force` par la configuration explicite de la politique de nettoyage (`firebase functions:artifacts:setpolicy --days 1` une fois, ou `"functions": { "cleanupPolicy": ... }` si supporté par la version) et laisser le déploiement échouer sur une suppression non confirmée ; ou ajouter dans `functions/src/index.test.ts` un test qui importe `index.ts` et vérifie la liste exacte des exports attendus (`checkMedicationReminders`, `onSleepEntryWritten`, `tickSleepTimerNotifications`, `askVaccinePurchase`, `onPediatricianVisitWritten`, `remindVaccineDay`).
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-18] Les previews Vercel pointent sur la base Firestore de production
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `.github/workflows/preview-auth-domain.yml:1-4`, `.env.live:1-14`, `src/lib/firebase.ts:20,28-31`
- **Constat** : Le workflow d'autorisation de domaine n'a de sens que parce que les previews utilisent le projet Firebase réel (mêmes `VITE_*` Vercel, `VITE_USE_FIREBASE_EMULATORS` faux). Toute branche en cours (y compris une branche agent non relue) qui s'exécute en preview lit et **écrit** les vraies données familiales (`.env.live` le signale pour le mode local, pas pour les previews). Avec un seul utilisateur, c'est un choix assumé — mais aucun garde-fou (bandeau, confirmation) ne distingue preview et prod dans l'UI.
- **Impact** : Un bug d'import/suppression (`deleteBabyWithData`, `importBabyData`) testé en preview détruit/duplique les données prod.
- **Solution proposée** : Soit un second projet Firebase `baby-tracker-staging` avec des env Vercel « Preview » distinctes (et le workflow SEC-01 pointant sur ce projet : `PROJECT_ID` variable par env), soit a minima afficher un bandeau « PREVIEW — données réelles » quand `import.meta.env.VITE_VERCEL_ENV === 'preview'` (exposer `VERCEL_ENV` via `VITE_VERCEL_ENV` dans les env Vercel) et désactiver les actions destructrices (import/suppression) hors prod.
- **Complexité du fix** : M (projet staging) / S (bandeau)
- **Confiance** : Moyenne (config Vercel non vérifiable)

### [SEC-19] Cache Firestore persistant non vidé à la déconnexion
- **Sévérité** : Nit
- **Catégorie** : sécurité
- **Fichier(s)** : `src/lib/firebase.ts:24-26`, `src/contexts/AuthContext.tsx:108-110`
- **Constat** : `persistentLocalCache` garde toutes les données lues (entrées, photos en data URL) en IndexedDB ; `logout()` appelle seulement `signOut`. Sur un appareil partagé, les données restent lisibles via DevTools après déconnexion. Compte unique familial → impact faible.
- **Impact** : Données bébé lisibles localement après « Log out ».
- **Solution proposée** : Dans `logout()` : `await signOut(auth); await terminate(db); await clearIndexedDbPersistence(db); location.reload()` (l'ordre terminate → clear est requis par le SDK). Test : mock de `terminate`/`clearIndexedDbPersistence` appelés dans `AuthContext.test.tsx`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-20] README vide
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `README.md:1-3`
- **Constat** : « Hello ». Les informations utiles sont dispersées dans `plan.md` (53 Ko), `docs/notifications-setup.md`, les commentaires de `.env.live`, `scripts/seed-emulator.mjs`.
- **Impact** : Onboarding (ou reprise par un agent) sans les commandes `dev`/`dev:live`/`seed:emulator`, sans la procédure de déploiement manuel des règles (SEC-02), sans la liste des secrets CI.
- **Solution proposée** : README de 30 lignes : prérequis (Node 24, Java pour l'émulateur), `cp .env.example .env.local`, `firebase emulators:start`, `npm run seed:emulator`, `npm run dev`, tests, déploiement (Vercel auto, functions via CI, règles/index manuels ou via SEC-02), secrets GitHub nécessaires, lien vers `plan.md`/`docs/`.
- **Complexité du fix** : S
- **Confiance** : Haute

### [SEC-21] Petits points CI/config
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `.github/workflows/ci.yml:21-22`, `vitest.config.ts:28-38`, `tsconfig.node.json:22`, `package.json:31`, `scripts/seed-emulator.mjs:11-12`, `src/pages/LoginPage.tsx:4-5`, `src/components/Layout.tsx:27`
- **Constat** : (a) `vitest.config.ts` définit des seuils de couverture 80 % mais la CI lance `npm test` (pas `test:coverage`) : les seuils ne sont jamais appliqués. (b) `tsconfig.node.json` n'inclut que `vite.config.ts` : `vitest.config.ts` et `scripts/*.mjs` ne sont pas typés/vérifiés. (c) `firebase-admin` (lourd) est en devDependency racine uniquement pour `seed-emulator.mjs`. (d) `seed-emulator.mjs:11-12` utilise `??=` : une variable `FIRESTORE_EMULATOR_HOST=""` (chaîne vide) n'est pas remplacée et l'Admin SDK, qui teste la présence, pourrait alors viser le projet réel `baby-tracker-c8fd2` avec des credentials ambiantes — ajouter un garde `if (!process.env.FIRESTORE_EMULATOR_HOST) throw`. (e) `LoginPage.tsx:4-5` embarque `DEV_EMAIL`/`DEV_PASSWORD` dans le bundle prod (inoffensif : le formulaire n'est rendu que si `devLoginAvailable`) — déplacer dans une condition `import.meta.env.DEV`. (f) `Layout.tsx:27` accepte `url.startsWith('/')` : `//host` passe le test (react-router/pushState refuse ensuite une URL cross-origin, donc non exploitable) — préférer `/^\/(?!\/)/.test(url)`.
- **Impact** : Dérive silencieuse de la couverture ; risque théorique du seed ; bruit dans le bundle.
- **Solution proposée** : CI : `npm run test:coverage` ; `tsconfig.node.json.include: ["vite.config.ts","vitest.config.ts"]` ; garde explicite dans le seed ; regex d'URL dans `Layout.tsx`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- Le mécanisme de verrou `sleepTimer` est bien conçu : batch atomique client (`writeRunningSleep`) + `getAfter()` côté règles, exclusion correcte de `sleepEntries`/`locks` dans le wildcard, libération implicite par `exists()`/`endedAt`, et le cas `resource == null` sur delete est géré. Je n'ai trouvé aucun contournement permettant deux siestes en cours sur un même bébé depuis le client.
- Catch-all `allow read, write: if false`, double contrôle email + `memberUids`, `fcmTokens` scellés à l'uid, imports CSV filtrant les siestes en cours : cohérents avec le code des repositories (toutes les écritures client passent les règles actuelles).
- CI : `permissions: contents: read` par défaut, élévation limitée au job Dependabot, `concurrency` sur les déploiements, cooldown Dependabot, `singleProjectMode` émulateur, aucun secret dans l'historique git, `.env.local` ignoré. `tsc` 7 applique `strict` par défaut (vérifié).
- Service worker : les URL de navigation issues des notifications sont relatives et construites par le SW lui-même ; le postMessage vers la page est filtré sur `type`/préfixe.

## Zones non couvertes
- Réglages non vérifiables statiquement : fournisseurs Auth activés, restrictions de la clé API, App Check, rôles IAM du service account, index composites existants en console, réglages Vercel (previews pour tous/membres, env par environnement), protection de branche `main`.
- `functions/src/vaccineReminders.ts`, `parisTime.ts` et les tests `functions/` n'ont été lus que pour les requêtes Firestore (index) et les payloads FCM ; leur logique métier relève d'une autre revue.
- Composants/pages (`src/components`, `src/pages`) lus uniquement pour les appelants nécessaires (photo, reminders, Layout, Login, FamilyPage).
