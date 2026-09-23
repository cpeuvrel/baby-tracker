# baby-tracker — plan d'implémentation

> Document destiné à être donné à une autre instance Claude pour l'implémentation.
> Contexte : l'app "Nara Baby & Mom Tracker" (utilisée quotidiennement par les deux parents) est jugée trop chère/verrouillée par l'utilisatrice.
> Objectif : une app de remplacement perso, réservée à 2 parents, dont **l'UX doit coller à celle de Nara** (voir section 6 — patrons d'écrans détaillés, ne pas re-rechercher) pour ne pas casser les habitudes déjà prises.

> **Note de recherche (confirmée)** : app identifiée = *Nara Baby & Pregnancy Tracker* (App Store, id1444639029) alias "Nara Baby & Mom Tracker" sur nara.com, éditeur Nara Organics, Inc. (US), en anglais uniquement, aucune version française. Paywall freemium + achats intégrés/abonnement **déjà actif**, pas "à venir" (confirmé via la fiche App Store : "Free with in-app purchases").

> **État (2026-09-23)** : les 7 phases (section 10) sont implémentées, ainsi que les 8 ajouts hors phasage initial ci-dessous :
> 1. **Refonte UX de History et Trends** à partir de vraies captures d'écran de l'app Nara de l'utilisatrice (thème sombre réel, bébé "Maëlys") partagées en cours de route — plus précises que les captures marketing utilisées pour écrire la section 6 initialement. Sections 6.1, 6.5 et 7 mises à jour en conséquence.
> 2. **Import/export basculé en CSV seul** (JSON abandonné) avec import direct d'un vrai export RGPD Nara, format découvert et vérifié sur un fichier réel de 1882 lignes. Section 9 mise à jour, détail complet dans `docs/export-format.md`.
> 3. **Courbes de percentiles OMS pour la croissance implémentées** (initialement notées "extension v1.1, non bloquant" — section 7/11 mises à jour). Sexe du bébé ajouté au modèle (`sex: 'male' | 'female' | null` sur `Baby`), tables OMS LMS (poids/taille/périmètre crânien, 9 percentiles de référence) en `src/lib/whoGrowthData.ts` + calcul en `src/lib/growthPercentiles.ts`, nouvel écran `GrowthDetailPage` (patron identique à `TrendDetailPage` : graphe percentile avec courbe de l'enfant superposée aux courbes de référence, bascule vue liste, callout par point avec percentile/âge/édition) accessible depuis chaque ligne Growth de l'écran Activity. CDC non repris (OMS seul, contrairement à la formulation initiale "OMS/CDC" de la section 7).
> 4. **Refonte Family → Account implémentée** (2026-09-23), à partir de vraies captures d'écran de la section Account de Nara. Nouveaux écrans `AccountPage` (liste Family/Settings), `FamilyPage` réécrite (Children avec lien vers Child, plus de formulaire inline ni de section Pregnancy), `AddChildPage`, `ChildPage` (profil + Age calculé + Settings + Export/Import Data, sans Use Adjusted Age ni Notes & Photos), `AccountSettingsPage` (compte connecté + Log out, sans Communication), `EditActivitiesPage` (nouveau, fonctionnel : masque/affiche les cartes de l'écran Activity via `useActivityVisibility`, persistance `localStorage`). `SettingsSection.tsx` supprimé (absorbé par `ChildPage`). Le menu "⋯" du header (qui ne contenait que le logout) est retiré, remplacé par Account > Settings > Log out. `ExportImportSection` prend maintenant `householdId`/`baby` en props plutôt que de lire `selectedBaby` du contexte. Routes sous `/account`, `/account/family`, `/account/family/add`, `/account/family/:babyId`, `/account/family/:babyId/activities`, `/account/settings` (section 6.8, 9, 10 mises à jour). Décidé : pas de "Stop Tracking" (hors scope v1). "Nighttime Hours" alors resté un point ouvert, implémenté depuis dans l'ajout 7 ci-dessous.
> 5. **Authentification : migration vers Google Sign-In implémentée** (2026-09-23), remplace Email/Password. Repris de la PR [#2](https://github.com/cpeuvrel/baby-tracker/pull/2) de Corentin (implémentation similaire à une première version faite en parallèle, mais pas identique — celle de la PR a été retenue comme base, voir section 1b pour le détail). `AuthContext.tsx` (`loginWithGoogle()` via `GoogleAuthProvider`, remplace `login(email, password)`), `LoginPage.tsx` (un seul bouton "Sign in with Google" + message d'erreur venant du contexte), `firestore.rules` (ajoute une fonction `isAllowedEmail()` vérifiant `request.auth.token.email`, **en plus** de la vérification `memberUids` existante — pas un remplacement). **Décision produit** : un **seul compte Google partagé** pour les deux parents (`amandineandcorentin@gmail.com`), pas deux comptes individuels comme envisagé initialement — en conséquence `households.ts`/`HouseholdContext.tsx`/`scripts/seed-emulator.mjs` (adapté, voir point 6) **n'ont pas changé sur le fond** (toujours `subscribeToHouseholdForUser(uid, ...)` filtré par `memberUids`, cohérent puisqu'il n'y a jamais qu'un seul uid). Si l'email du compte connecté n'est pas dans l'allowlist, `AuthContext` déconnecte automatiquement et affiche "This Google account is not authorized." — géré côté client, pas seulement par les Security Rules. **Écart avec la PR d'origine, résolu en hybride** : `signInWithRedirect` ne complète jamais la connexion contre l'Auth Emulator sur `localhost` (`getRedirectResult` reste `null` indéfiniment, aucune erreur, aucun compte créé côté émulateur) — **bug connu et non résolu du SDK Firebase / firebase-tools** (confirmé par plusieurs issues GitHub ouvertes sur `firebase/firebase-js-sdk` et `firebase/firebase-tools`, ex. #9108, #6671, #8652, #6341 — spécifique à la combinaison émulateur + `http://localhost` non-HTTPS, pas un bug de ce projet). Solution retenue dans `AuthContext.tsx` : `usesEmulator()` (basé sur `VITE_USE_FIREBASE_EMULATORS`) choisit `signInWithPopup` en dev local (contourne le bug) et garde `signInWithRedirect` + `getRedirectResult()` pour le vrai déploiement (raison initiale du choix de Corentin : plus fiable que popup sur mobile, notamment iOS Safari). Le redirect en prod réel n'a pas encore été testé sur un vrai téléphone — à vérifier après déploiement.
> 6. **Onboarding "Create Family" ajouté** (2026-09-23) : à la première connexion (aucun household existant pour le compte), l'app affichait un écran totalement blanc (plusieurs écrans font `if (!household) return null`) — remplacé par un écran d'accueil (`CreateFamilyPage.tsx`) qui invite à saisir le premier enfant (First Name, Sex, Birthdate — **les 3 obligatoires**, y compris Sex qui n'a pas de validation HTML native puisque ce n'est pas un `<input>`). À la validation, crée le household (`createHousehold()`, nouveau dans `households.ts` — `{ name: 'My Family', memberUids: [uid] }`) puis le bébé dessus (`addBaby`). Une fois le household créé, l'abonnement temps réel (`HouseholdContext`) bascule automatiquement vers l'app normale, sans navigation manuelle. `App.tsx` restructuré : `BrowserRouter`/les routes ne sont montés que si un household existe ; sinon `CreateFamilyPage` s'affiche hors layout (comme `LoginPage`, pas de header/tab bar). Le même garde-fou "3 champs obligatoires" (y compris Sex) a été ajouté à `AddChildPage.tsx` (ajout d'un enfant supplémentaire depuis Family), qui ne le vérifiait pas jusqu'ici.
> 7. **Fidélité de l'écran Child (section 6.8) complétée** (2026-09-23), à partir des captures Nara réexaminées : **Nighttime Hours implémenté** (point resté ouvert depuis l'ajout 4) — nouveau champ `nighttimeHours: { start, end } | null` sur `Baby` (optionnel dans le type pour ne pas casser les fixtures de test existantes), écran dédié `NighttimeHoursPage.tsx` (From/To, patron identique aux autres écrans détail), `updateNighttimeHours()` dans `babies.ts`. Le calcul des réveils nocturnes (section 7, `aggregations.ts`/`trendMetrics.ts`) accepte maintenant une plage en paramètre au lieu d'une constante fixe (`DEFAULT_NIGHTTIME_HOURS`, alignée sur le défaut Nara `20:00–08:00` — remplace l'ancienne constante interne `20h–7h`, utilisée en fallback pour les bébés sans réglage). **Toggle Metric/Imperial retiré** de l'écran Child (absent des captures Nara, gardait metric par défaut — `useUnitPreference`/le formattage impérial restent dans le code pour Growth, juste plus exposés comme réglage ici). **Import CSV passé en 2 étapes** (`ExportImportSection.tsx`) : le champ fichier ne lance plus l'import automatiquement au choix du fichier, un bouton "Import Data" séparé (désactivé tant qu'aucun fichier n'est choisi) déclenche l'import. **UI généralement retouchée** à partir de retours visuels directs (pas de nouvelles captures Nara) : contrôle segmenté (`.segmented-control`, un seul conteneur pilule) pour Sex (Boy/Girl) sur `AddChildPage`/`ChildPage`/`CreateFamilyPage` au lieu de deux boutons pilule séparés ; Export/Import Data sur l'écran Child stylés comme des liens de réglage (`.settings-action`, gras, sans fond de bouton) plutôt que de gros boutons pleins.
> 8. **Écran Growth (`GrowthDetailPage.tsx`) revu** (2026-09-23) sur retour direct de l'utilisatrice (pas de nouvelles captures Nara) : la **vue graphe n'affiche plus que le graphe** — la carte "callout" qui apparaissait systématiquement en dessous d'un point cliqué (date, valeur, percentile, âge, source, boutons Edit/Dismiss) a été retirée ; éditer une mesure se fait désormais depuis la vue liste uniquement. La **vue liste** (icône en haut à droite) affiche chaque entrée sur 3 lignes empilées (`{Metric} {valeur}` / `{Sexe} Percentile {valeur}% ›` / `Age {valeur}`) au lieu d'une seule ligne compacte — le chevron de navigation vers l'édition reste sur la ligne percentile uniquement, pas sur toute la ligne.

## 0. Prérequis avant de commencer (poste Windows) — pas à pas

✅ Déjà fait : VS Code, Claude Code, Git for Windows.

Reste à faire, **dans cet ordre** :

### 1. Vérifier/configurer Git
Ouvrir un terminal (PowerShell) :
```
git config --global user.name "Ton nom"
git config --global user.email "ton-email@example.com"
```
Nécessaire une seule fois — sans ça, les commits n'ont pas d'auteur.

### 2. Node.js LTS
Télécharger et lancer l'installeur `.msi` depuis https://nodejs.org (bouton "LTS"). Installation par défaut (Next, Next...). Vérifier dans un **nouveau** terminal :
```
node -v
npm -v
```

### 3. Java (JDK), n'importe quelle version ≥ 11
Télécharger l'installeur Windows `.msi` depuis https://adoptium.net (Temurin). Pendant l'installation, laisser cochées les options par défaut ("Add to PATH", "Set JAVA_HOME"). Vérifier :
```
java -version
```
Nécessaire pour l'émulateur Firestore (section 4b), pas juste pour Node.

### 4. Compte GitHub + repo privé
1. Créer un compte sur https://github.com (si pas déjà fait).
2. "New repository" → nom `baby-tracker` → **Private** → Create (sans README ni .gitignore pour l'instant).
3. Dans un terminal, sur ce PC :
```
git clone https://github.com/<ton-user>/baby-tracker.git
cd baby-tracker
```
4. Copier le contenu de ce `plan.md` (celui-ci) dans un nouveau fichier `plan.md` à la racine du dossier cloné (créer le fichier dans VS Code, copier-coller le texte depuis le Mac).
5. Puis :
```
git add plan.md
git commit -m "Add implementation plan"
git push
```
Au premier `push`, une fenêtre de navigateur s'ouvre pour se connecter à GitHub (Git Credential Manager, inclus avec Git for Windows) — se connecter là, rien à configurer à la main.

### 5. Compte Google + projet Firebase
1. https://console.firebase.google.com, se connecter avec un compte Google.
2. "Ajouter un projet" → nommer `baby-tracker` (Google Analytics : décliner, pas utile ici).
3. Dans le projet : menu **Build → Firestore Database → Créer une base de données** → mode production → choisir une région proche (ex. `europe-west`).
4. Menu **Build → Authentication → Get started** → activer la méthode "E-mail/Mot de passe". *(Historique : remplacé depuis par Google Sign-In, voir section 1b — à l'avenir activer plutôt "Google" ici.)*
5. Dans un terminal :
```
npm install -g firebase-tools
firebase login
```
(ouvre le navigateur, se connecter avec le même compte Google). Ne pas lancer `firebase init` maintenant — ça se fait en Phase 1, une fois le dossier du projet Vite créé.

**Carte bancaire : pas maintenant.** Le plan gratuit "Spark" suffit pour démarrer (Firestore, Auth, Hosting, FCM). Le plan payant "Blaze" (carte obligatoire, coût réel ≈ 0€/mois à cet usage) ne sera nécessaire qu'en Phase 5 (Médicament & rappel, section 8) — prévoir une alerte de budget à 0€/1€ à ce moment-là.

### 6. Compte Vercel
1. https://vercel.com/signup → **"Continue with GitHub"** (recommandé : lie directement les deux comptes).
2. Autoriser l'accès au repo `baby-tracker` (on peut restreindre à "Only select repositories").
3. Rien d'autre à faire maintenant — l'import du projet Vercel se fait en Phase 1/2, une fois qu'il y a un build à déployer.

### 7. Vérifier Claude Code
Ouvrir un terminal, lancer `claude`. S'il n'est pas déjà connecté, une connexion par navigateur est demandée — vérifier que c'est bien le compte prévu pour l'implémentation.

Pas besoin de compte développeur Apple/Google Play (ce n'est pas une app de store) ; les icônes PWA et la config FCM se font pendant l'implémentation.

Une fois tout ça fait, donner ce `plan.md` (déjà dans le repo depuis l'étape 4) à l'instance Claude qui implémente — il contient tout le contexte nécessaire.

## 1. Décisions déjà prises (ne pas rouvrir sans raison)

- **Plateforme** : PWA (web app installable sur l'écran d'accueil), un seul code pour les deux téléphones. Pas d'app native.
- **Stack conseillée** : React + Vite + TypeScript, service worker pour l'installabilité, le offline et les notifications push.
- **Backend/sync** : **Firebase** (Firestore + Authentication + Cloud Functions + Cloud Messaging/FCM). Choisi après comparaison explicite avec Supabase — arbitrage assumé :
  - **Pour Firebase** : persistance offline intégrée au SDK web (`enableIndexedDbPersistence`/`persistentLocalCache`, pas de queue locale à coder à la main) et push (FCM) plus clé en main que du Web Push maison.
  - **Contre Firebase, accepté comme compromis** : pas de `GROUP BY`/agrégation serveur (calcul des moyennes/stats en JS côté client — sans souci de perf à cette échelle : 2 utilisateurs) ; le rappel médicament programmé (section 8) demande le plan payant "Blaze" (carte bancaire, coût réel ~0€) ; migration/auto-hébergement futur plus lourd que "juste du Postgres".
- **Hébergement** : **Vercel** pour le moment (voir section 0, point 7).
- **Auth** : voir section 1b — **Google Sign-In avec un compte partagé par les deux parents**, remplace la méthode de connexion email/mot de passe initialement implémentée. L'autorisation reste basée sur `memberUids` (inchangé), avec une allowlist d'email en couche supplémentaire. Toujours minimal : pas de signup public, pas de gestion multi-foyers généralisée.
- **Repo** : `~/project/baby-tracker` (créé, vide pour l'instant).

## 1b. Authentification — Google Sign-In (code implémenté le 2026-09-23, repris de la PR #2 de Corentin, déploiement manuel restant)

**Contexte** : la version initialement implémentée (phase 1, section 10) utilisait Firebase Auth email/mot de passe + un champ `memberUids` sur le household, vérifié dans les Security Rules. Décision changée après coup, pour éviter tout écran de mot de passe (un mécanisme d'invitation par Anonymous Auth a aussi été envisagé puis écarté — il évite le mot de passe mais l'UID est lié à l'appareil, donc perdu à chaque changement de tel/réinstallation, ce qui oblige à ré-appairer via un lien). Deux implémentations ont été écrites en parallèle (l'une dans ce repo, l'autre dans la [PR #2](https://github.com/cpeuvrel/baby-tracker/pull/2) de Corentin sur `cpeuvrel/baby-tracker`, la nouvelle origine du repo) — **c'est la version de la PR #2 qui a été retenue et reprise telle quelle**, décrite ci-dessous. Elle diffère de la première tentative sur deux points structurants (voir la comparaison à la fin de cette section).

**Décision retenue (implémentée en code)** :
- **Un seul compte Google partagé** pour les deux parents (`amandineandcorentin@gmail.com`), pas un compte individuel par parent — les deux téléphones se connectent avec les mêmes identifiants Google. Ce choix évite de toucher à la logique existante de household/`memberUids` : il n'y a toujours qu'un seul uid possible, donc `households.ts` (`subscribeToHouseholdForUser(uid, ...)`, filtré par `memberUids array-contains uid`) et `HouseholdContext.tsx` **n'ont pas changé**.
- **Méthode de connexion** : Firebase Authentication, fournisseur **Google** uniquement (`signInWithRedirect` + une instance module-level de `GoogleAuthProvider` dans `AuthContext.tsx` — pas de popup, plus fiable sur mobile). `LoginPage.tsx` n'a plus qu'un bouton "Sign in with Google" ; l'état d'erreur (`error`) vit maintenant dans `AuthContext` (exposé par `useAuth()`) plutôt que localement dans `LoginPage`, puisqu'une erreur peut aussi venir du listener d'auth lui-même (voir point suivant), pas seulement du clic.
- **`getRedirectResult(auth)` appelé au montage** (dans le même `useEffect` que `onAuthStateChanged`) pour capter les erreurs de la redirection Google (ex. domaine non autorisé) et afficher "Unable to sign in with Google." plutôt que d'échouer silencieusement.
- **Allowlist vérifiée côté client ET côté serveur** :
  - Client (`AuthContext.tsx`) : `ALLOWED_EMAILS = ['amandineandcorentin@gmail.com']` ; dans le listener `onAuthStateChanged`, si l'email du compte connecté n'y figure pas, déconnexion immédiate (`signOut`) + message "This Google account is not authorized." — évite qu'un compte Google quelconque reste "connecté" dans l'UI en échouant seulement plus tard sur les lectures Firestore.
  - Serveur (`firestore.rules`) : nouvelle fonction `isAllowedEmail()` (même liste, en dur) **ajoutée en plus** de la vérification `memberUids` existante (`isHouseholdMember`), pas en remplacement — les deux conditions sont requises (`isAllowedEmail() && uid in memberUids`).
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
  L'email est en dur dans le code, versionné, déployé via `firebase deploy --only firestore:rules` — cohérent avec "pas de généralité spéculative" (section 12).

**Différences avec la première tentative (non retenue)** : celle-ci visait deux comptes Google individuels (un par parent) avec une allowlist à deux emails, et remplaçait entièrement `memberUids` par l'email comme mécanisme d'autorisation (`households.ts` simplifié en `subscribeToHousehold()` sans filtre, `scripts/seed-emulator.mjs` simplifié). Elle n'avait pas de vérification d'allowlist côté client (une connexion avec un compte non autorisé échouait silencieusement sur les lectures Firestore, sans message clair) ni de gestion de `getRedirectResult()`. Écartée au profit de l'approche compte-partagé de la PR #2, plus proche du code existant (diff plus petit, `memberUids` reste la source de vérité pour l'autorisation).

**Reste manuel avant un vrai déploiement** (l'app est déjà en prod avec de vraies données, respecter cet ordre pour ne rien casser pendant la bascule) :
1. ⬜ Firebase Console → Authentication → Sign-in method → activer "Google" **en plus** d'Email/Password pour l'instant (ne pas encore désactiver l'ancien).
2. ⬜ Déployer ce nouveau code frontend (Vercel), **puis seulement après** déployer la nouvelle `firestore.rules` — jamais l'inverse.
3. Se connecter une fois avec le compte Google partagé sur les deux téléphones et vérifier l'accès aux données existantes.
4. Nettoyage (non urgent, une fois l'accès confirmé stable) : désactiver Email/Password dans la Console, supprimer les anciens comptes dans Authentication → Users.

## 2. Fonctionnalités demandées (confirmées par l'utilisatrice)

1. **Import/export** des données, y compris **import des données existantes issues de Nara** une fois récupérées (voir section 9 — action requise côté utilisatrice, pas de bouton export connu dans Nara).
2. **Suivi nourriture** : saisie rapide (heure + quantité/type), **pas de chrono** — voir section 3 pour le détail biberon/solide.
3. **Suivi sommeil** avec chrono (comme Nara), avec un minuteur affiché en permanence pendant que le suivi est actif — bandeau/popup persistant montrant le temps écoulé. Pattern jugé très utile dans Nara, à reproduire (détails UX en section 6). C'est le seul type d'entrée qui a un état "en cours" (sommeil ; voir section 3 pour pourquoi la nourriture n'en a pas).
4. **Visualisation graphique** : courbes, **moyennes et agrégations** des données (ex : durée moyenne de sommeil/jour et /semaine, nombre et volume de biberons par jour). Détails en section 7.
5. **Synchronisation** entre les téléphones des deux parents, en quasi temps réel (si un parent lance un chrono, l'autre doit le voir immédiatement).
6. **Suivi médicament** (ex : vitamine D) **avec rappel/alerte** si la prise du jour n'a pas été enregistrée. Détails en section 8.
7. **Plusieurs bébés** dans le même foyer (ex : plusieurs enfants) — sélecteur de bébé dans l'app, chaque écran/graph filtré sur le bébé sélectionné.
8. **Courbes de croissance** (poids/taille) — voir sections 4 et 7.
9. **Suivi couches** (mouillée/sale/les deux/sèche) — voir section 4. Vocabulaire `wet`/`dirty`/`both`/`dry` (et non `pee`/`poop`), aligné sur les 4 états réels observés dans l'export Nara plutôt que sur une supposition initiale à 3 états. Boutons de saisie affichés en anglais (Wet/Dirty/Both/Dry, comme les onglets de navigation section 6.3) plutôt qu'en français.

## 3. Nourriture : mode de saisie (résolu)

Le scope (nourriture, sommeil, visualisation, médicament, multi-bébé, croissance) est confirmé. Allaitement et tire-lait sont explicitement **hors scope** (pas de chrono par sein, pas de suivi pompage) — seuls biberon et solides sont suivis côté nourriture.

**Biberon et solide sont des entrées instantanées, pas des chronos** — contrairement au sommeil (chrono start/stop, section 6.4) :
- Pas de bouton "Start" qui laisse un document "en cours" en arrière-plan : le formulaire s'ouvre déjà rempli avec l'heure actuelle (modifiable), on complète le reste, un tap "Save" et c'est fini.
- Pas de bandeau persistant ni de notification pour ces deux types (section 6.9 ne concerne que le sommeil, et plus tard le médicament).
- Justification : c'est le comportement réel de Nara — sur son écran d'accueil, la carte "Feed" affiche un montant statique ("6oz"), jamais un compteur en cours ; le seul chrono de repas côté Nara est celui de l'allaitement au sein, explicitement hors scope ici (voir ci-dessus). C'est aussi cohérent avec le reste du modèle de données : `diaperEntries` et `medicationEntries` (section 4) sont déjà des entrées instantanées, `feedingEntries` doit suivre le même pattern plutôt qu'être un cas à part.
- Si en pratique un chrono biberon s'avère utile après tout (mesurer la durée de la tétée au biberon), le dire avant de coder la phase 2 (section 10) — sinon, saisie instantanée pour les deux types.

**Champs par type** (les deux partagent un seul écran de saisie — un champ numérique ou texte selon le type sélectionné, pas deux formulaires quasi identiques) :
- Commun : `occurredAt` (heure de la prise, modifiable, défaut = maintenant).
- Biberon : `volumeMl` (nombre, optionnel — pas de valeur forcée, certaines prises n'ont pas de mesure précise), `notes` (optionnel).
- Solide : `foodType` (texte libre court, optionnel — pas de liste fermée d'aliments en v1), `notes` (optionnel).

**Suivi grossesse/post-partum, vaccins, milestones, module médical général sont hors scope v1** (voir section 11) — Nara les propose mais l'utilisatrice ne les a pas demandés.

## 4. Modèle de données (Firestore)

Firestore est un NoSQL orienté documents — pas de tables/jointures. Structure suggérée, en sous-collections par bébé :

```
households/{householdId}
  name
  memberUids: [uid1]         -- toujours la base de l'autorisation (section 1b) ; un seul uid en pratique depuis le passage à un compte Google partagé, mais le champ reste un tableau

households/{householdId}/babies/{babyId}
  name, birthDate, sex: "male" | "female" | null   -- sex requis pour afficher les courbes de percentile OMS (section 7)
  nighttimeHours: { start: "HH:mm", end: "HH:mm" } | null   -- plage nuit pour le calcul des réveils nocturnes (section 7/6.8), défaut 20:00–08:00 si absent

households/{householdId}/babies/{babyId}/feedingEntries/{entryId}
  type: "bottle" | "solid"
  occurredAt                           -- entrée instantanée (section 3), pas de chrono
  volumeMl (nullable, pertinent si bottle)
  foodType (nullable, pertinent si solid)
  notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/sleepEntries/{entryId}
  startedAt, endedAt, durationSeconds
  notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/diaperEntries/{entryId}
  type: "wet" | "dirty" | "both" | "dry"   -- 4 états réels Nara (pas 3) ; "dry" = couche vérifiée/changée sans rien dedans
  occurredAt, notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/growthEntries/{entryId}
  measuredAt
  weightG, heightMm, headCircumferenceMm (tous nullable)
  notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/medicationEntries/{entryId}
  name,                                -- ex: "Vitamine D"
  givenAt, dose, notes, createdBy, createdAt

households/{householdId}/babies/{babyId}/reminders/{reminderId}
  medicationName, timeOfDay, active

users/{uid}/fcmTokens/{tokenId}
  token, createdAt                     -- un par appareil installé, pour l'envoi FCM
```

- **Security Rules** : deny-by-default en tête de fichier, puis autoriser lecture/écriture uniquement si `request.auth.uid` figure dans `households/{householdId}.memberUids` **et** si l'email du token (`request.auth.token.email`) figure dans l'allowlist en dur du fichier (voir section 1b — les deux conditions sont requises, l'allowlist email s'ajoute à `memberUids` plutôt que de le remplacer).
- Le **chrono** (sommeil uniquement, section 6.4) = un document créé avec `startedAt` rempli et `endedAt = null` ("en cours"). Le stop remplit `endedAt` et calcule `durationSeconds`. Nourriture (section 3), couches et médicament n'ont jamais cet état "en cours" : `occurredAt`/`givenAt` est rempli directement à la création.

## 4b. Workflow de dev (local d'abord, comme IntelliJ + BD locale → AWS)

- **En dev** : `npm run dev` (Vite) + **Firebase Local Emulator Suite** (`firebase emulators:start` — Firestore, Auth, Functions simulés en local, avec une UI web pour inspecter les données, l'équivalent de pgAdmin). Aucun appel au vrai Firebase cloud pendant le dev courant, pas de risque sur les données réelles, la logique de la Cloud Function programmée (section 8) est testable via l'émulateur sans passer au plan Blaze.
- **En "prod"** (ici, seul environnement réel — pas de staging séparé, 2 utilisateurs) : `firebase deploy` (Security Rules + Functions) et `git push` → déploiement auto Vercel du frontend.
- Limite : push notifications et offline en conditions réelles ne sont vérifiables qu'après déploiement (HTTPS réel sur téléphone) — l'émulateur ne simule pas cette partie.

## 5. Offline & sync temps réel

Le suivi se fait souvent sans bonne connexion (nuit, chambre). Avec Firebase :
- **Offline quasi gratuit** : activer le cache local persistant du SDK Firestore web (`persistentLocalCache` / `enableIndexedDbPersistence`) — écritures et lectures fonctionnent hors-ligne, sync automatique au retour du réseau. Pas de queue à coder à la main.
- Conflits : dernier écrit gagne (suffisant à 2 utilisateurs, pas de résolution avancée à construire).
- **Sync temps réel** : `onSnapshot()` sur les documents "en cours" propage l'état (chrono actif) à l'autre téléphone dès que la connexion le permet.

## 6. UX & design de référence (app Nara) — à reproduire, ne pas re-rechercher

**Contrainte prioritaire (demande explicite)** : l'UX de cette app doit coller à celle de Nara Baby & Mom Tracker — c'est l'app que l'utilisatrice utilise déjà tous les jours, l'objectif est de ne pas casser ses habitudes. Cette section a été écrite après inspection directe des captures d'écran officielles (App Store id1444639029 + nara.com, recherche faite le 2026-09-22) : **tout ce qui est utile est déjà décrit ci-dessous, ne pas refaire cette recherche** (couleurs = estimations visuelles à l'œil, pas des valeurs de design extraites d'un fichier source — les affiner librement, l'important est la structure et l'ambiance, pas le pixel-perfect).

### 6.1 Palette & typographie
- Fond général : ivoire/crème chaud (`#F7F1E4` approx.).
- Texte/titres/icônes primaires : bleu marine profond (`#1F3A5C` approx.).
- Bouton d'action principal (ex. "Stop Timer") : orange corail (`#F2703B` approx.), forme pilule.
- Couleur d'accent par catégorie (bandeau en haut de chaque carte, réutilisée dans les timelines) :
  - Nourriture (biberon) → jaune/ambre (`#F0C14B` approx.)
  - Sommeil → bleu clair (`#AFD0EA` approx.)
  - Croissance → vert tendre (`#B7D98F` approx.)
  - Médicament → lavande (`#C7C0E6` approx.) — Nara a une bande "Health" dans cette couleur avec icône thermomètre, directement réutilisable pour la section 8.
  - Couches → pas de couleur Nara confirmée dans les captures inspectées ; prendre une pastel non utilisée ailleurs (ex. rose poudré) pour éviter toute collision.
- Typo : police à empattements (serif, ex. Georgia/Lora) pour les titres d'écran et le nom du bébé ("Nara ⌵", "Family", "Growth") ; sans-serif système pour le texte courant des listes.
- Coins très arrondis partout (cartes, boutons, pilules), ombres douces, beaucoup d'espace blanc.
- **Thème sombre (confirmé sur captures réelles, remplace toute supposition antérieure)** : les couleurs d'accent par catégorie ci-dessus **ne changent pas** entre thème clair et sombre — seul le fond de page/texte/bordures bascule (fond crème `#F7F1E4`→marine profond `#1E2233`, texte marine→blanc cassé, pas de surface de carte "élevée" distincte du fond en sombre, ombres supprimées).

### 6.2 Écran d'accueil ("Activity")
- En-tête : avatar rond illustré du bébé + son nom + petit chevron ⌵ (tap = sélecteur multi-bébé, 6.7) + date du jour, à gauche ; deux boutons pilule à droite (notes, "…").
- Une carte empilée par catégorie (Nourriture, Sommeil, Croissance, Médicament, Couches). Chaque carte = bandeau de couleur (6.1) avec le nom de la catégorie à gauche et un bouton "+" rond (fond marine, "+" blanc) à droite pour ajouter une entrée ; en dessous, la dernière entrée sur une ligne (icône + libellé + heure relative "2h 10m ago" + valeur si pertinent + chevron) et un lien "Show more" pour déplier l'historique récent sans changer d'écran.

### 6.3 Navigation
Barre d'onglets en bas. Nara a 5 entrées (Activity, History, Trends, Guides, Account — confirmé sur capture réelle, remplace la supposition initiale "Shop") ; pour cette app, garder 4 : **Activity, History, Trends, Account** (pas de "Guides", pas de contenu éditorial). Le 4e onglet s'appelle **Account** (renommé depuis "Family" — voir section 6.8 pour son contenu détaillé : Family n'est plus qu'une des deux entrées de cet onglet, avec Settings). Onglet actif en marine avec un trait sous l'icône, inactifs en gris clair.

### 6.4 Chrono sommeil — le point le plus demandé
Ne s'applique qu'au sommeil (biberon/solide utilisent le formulaire de saisie instantanée de la section 3, pas cette modale). Au tap sur "+" (ou sur l'entrée sommeil "en cours"), une **modale plein écran** s'ouvre :
- bandeau de couleur de la catégorie en haut : "X" (fermer) à gauche, nom de la catégorie centré, "Save" en gras à droite.
- corps blanc : "Total Time" centré, gros compteur live `HH:MM:SS`, bouton pilule orange "Stop Timer" juste en dessous.
- puis en liste : "Start Time" (éditable), "End Time" ("Add" tant que non arrêté), "Notes" (texte libre), bouton pilule "Add Photo" en bas.

**Nuance pour l'implémentation PWA** : ces captures montrent la modale *à l'ouverture*, pas un bandeau visible en permanence par-dessus les autres écrans. Sur iOS, Nara couvre ce besoin via les **Live Activities** (écran verrouillé/Dynamic Island), inutilisables depuis une PWA. Le choix déjà pris section 5 (bandeau persistant in-app + notification FCM avec le temps écoulé) reste donc le bon substitut — reprendre dans ce bandeau la même densité d'info que la modale (icône catégorie, compteur live, bouton stop) pour rester cohérent visuellement quand on rouvre la modale complète depuis le bandeau.

### 6.5 Historique ("History") — confirmé et complété sur capture réelle
Vue calendrier hebdomadaire en haut (7 jours, jour courant en pastille marine pleine), avec un **filtre par type d'entrée en haut** (Sommeil/Nourriture/Couches, boutons togglables) qui masque/affiche les blocs correspondants sans changer de semaine. Chaque jour de la semaine = une colonne avec un bloc coloré par entrée positionné à son heure et dont la hauteur reflète la durée (couleur = catégorie, palette 6.1). **Tap sur un jour** → affiche en dessous le détail de cette journée (timeline verticale, une ligne par entrée). Navigation semaine précédente/suivante (‹ mois année ›).

### 6.5b Tendances ("Trends") — écran à sous-écrans, ajouté après coup sur exemples réels
Liste de lignes groupées par section (Nourriture / Sommeil / Couches), chaque ligne = icône catégorie + titre + moyenne/jour sur la période + badge delta (↑/↓ vs période précédente, coloré catégorie). Pilules de période en haut (1j/7j/14j), **pas de filtre par type** ici (contrairement à History). Tap sur une ligne → sous-écran dédié à cette métrique : bouton retour, gros chiffre (moyenne période), onglets Calendrier/Graphique/Entrées (le calendrier réutilise le rendu de 6.5 sur une seule métrique), mêmes pilules de période, légende de delta vs période précédente en bas.

### 6.6 Réglages de rappel (patron à réutiliser section 8)
Même modale qu'en 6.4 mais fond crème : titre "Nap Reminders" (→ adapter en "Rappel [médicament]"), lignes de réglage en haut, puis une **liste verticale type stepper** — une icône par évènement programmé (soleil = réveil, lune/zzz = sieste, étoile = coucher) reliée par un connecteur vertical, champ heure éditable à droite de chaque ligne. Pour le rappel médicament (un seul horaire par médicament), une seule ligne de ce type suffit.

### 6.7 Sélecteur multi-bébé
Le chevron ⌵ à côté du nom du bébé en en-tête (6.2) ouvre le sélecteur de bébé — pattern à reprendre tel quel pour le point 7 de la section 2 : pas un écran séparé, une simple action sur l'en-tête existant.

### 6.8 Écran "Account" (ex-"Family") — refonte à partir de captures réelles, implémentée le 2026-09-23
Écran atteint depuis le 4e onglet (**Account**, section 6.3). Liste groupée façon réglages iOS avec seulement deux lignes à chevron — les autres lignes de l'écran Account de Nara (**Subscription**, **Help**, "Share & Social") sont hors scope, pas de paywall/support/réseaux sociaux ici :
- **Family** → écran Family (ci-dessous).
- **Settings** → écran Settings (ci-dessous, différent du "Settings" par bébé de l'écran Child).

**Family**
- Section "Children" : une ligne par bébé (nom + âge calculé + chevron), tap → écran **Child** (ci-dessous). Lien "Add child" en bas de section → écran **Add Child** (ci-dessous). **Pas de section "Pregnancy"** (Nara en a une avec "Add pregnancy" — hors scope, déjà exclu section 11).
- Section "Caregivers" : une ligne par membre du foyer (email + "Your Profile" pour soi-même), **pas de bouton "Add caregiver"** — un caregiver = un compte Firebase Auth (email/mot de passe, section 1) ajouté via la console Firebase, pas depuis l'app. Comportement déjà en place dans `FamilyPage.tsx` (section "Parents"/hint actuel), à conserver tel quel.

**Add Child** (`AddChildPage.tsx`, remplace l'ancien formulaire inline en haut de la page Family)
- Champs : First Name, Sex (toggle Boy/Girl), Birthdate. **Pas de "Use Adjusted Age"** (Nara l'a pour gérer la prématurité ; notion hors scope ici). Bouton "Save" en en-tête, bouton retour à gauche (même patron d'en-tête que les modales, section 6.4/6.6). `addBaby()` accepte désormais `sex` dès la création.

**Child** (`ChildPage.tsx`, tap sur un bébé dans Family — remplace l'ancien `SettingsSection` qui n'agissait que sur le bébé globalement sélectionné)
- Champs : First Name, Sex (toggle Boy/Girl), Birthdate, Age (calculé en direct depuis le formulaire, lecture seule). **Pas de "Use Adjusted Age"**.
- Section "Settings" : ligne "Edit Activities" (chevron) → `EditActivitiesPage.tsx`, ligne "Nighttime Hours" (chevron + valeur courante, ex. "20:00 - 08:00") → `NighttimeHoursPage.tsx`. **Pas de toggle Metric/Imperial** (absent des captures Nara, retiré — metric reste le seul réglage utilisé, `useUnitPreference` continue d'exister pour le formattage de Growth ailleurs). **Edit Activities implémenté et filtré (décidé)** : se limite à nos catégories réelles (Feeding, Sleep, Diaper Changes, Growth, Medication — pas de distinction Bottle/Solid, alignée sur les 5 `CategoryCard` de l'écran Activity), pas la liste complète Nara (Breastfeeding, Pumping, Routines, Baby Firsts, Milestones, Medical, Vaccines — toutes hors scope, section 11). Chaque case à cocher masque/affiche en direct la carte correspondante sur l'écran Activity, préférence `localStorage` (`useActivityVisibility`, comme `useUnitPreference`), pas de bouton Save séparé (application immédiate). **"Nighttime Hours" implémenté (section 7)** : écran From/To (`<input type="time">`), défaut `20:00–08:00` (aligné sur Nara) si le bébé n'a pas encore de réglage, stocké sur `Baby.nighttimeHours` et utilisé par le calcul des réveils nocturnes.
- **Pas de section "Notes & Photos"** (pas de notes/photos en v1, cohérent avec le reste du scope).
- **Export Data** (lien/bouton, déjà spécifié section 9) **+ Import Data** juste à côté — points d'entrée réels de l'import/export (section 9), au niveau du bébé affiché sur cet écran. `ExportImportSection` prend maintenant `householdId`/`baby` en props (au lieu de lire `selectedBaby` du contexte), déplacé depuis `FamilyPage.tsx` vers `ChildPage.tsx`.
- **Pas de bouton "Stop Tracking" (décidé)** : visible chez Nara mais laissé de côté ici, pas de scope de suppression/archivage de bébé en v1.

**Settings** (`AccountSettingsPage.tsx`, au niveau du compte — distinct du "Settings" par bébé de l'écran Child ci-dessus)
- Affiche les infos du compte connecté (email) et un bouton **Log out**. Le menu "⋯" du header (`Layout.tsx`), qui ne contenait que ce même bouton, a été retiré — le logout vit désormais uniquement ici.
- **Pas de section "Communication"** (notifications/préférences marketing côté Nara — non pertinent ici, aucun contenu marketing dans cette app).

### 6.9 Notification/rappel en direct (complète 6.4)
En complément du bandeau persistant (6.4), une **notification système** ("Bébé dort depuis 14h32") via **FCM** permet de voir l'état sans ouvrir l'app — même brique technique que les rappels médicament (section 8), à construire une seule fois et réutiliser pour les deux usages.

### 6.10 Images de référence : décision prise — pas d'images dans le repo
Choix délibéré, pas un oubli : pas de captures Nara copiées dans le repo. Raisons — (1) ce sont des visuels propriétaires (App Store/marketing Nara), à éviter même dans un repo privé perso ; (2) une description écrite précise (6.1-6.8) coûte beaucoup moins de tokens à lire pour l'instance qui implémente qu'une image à faire analyser, et suffit pour une app perso (pas besoin de pixel-perfect). Si un doute subsiste sur un détail visuel précis en cours d'implémentation, redemander à l'utilisatrice plutôt que d'aller re-chercher les captures en ligne.

## 7. Graphes & agrégations

- Vue journalière "timeline" (comme Nara) : succession des entrées nourriture/sommeil/couches sur la journée (section 6.5, détail d'un jour sous le calendrier hebdo).
- **Écran Trends, structure finale (voir 6.5b)** : liste de métriques par section (pas des tuiles de stats brutes) — `Biberons`/`Volume total`/`Volume moyen` (Nourriture), `Sommeil total`/`Réveils nocturnes` (Sommeil), `Couches` (Couches). Chaque métrique = moyenne/jour sur la période sélectionnée (1j/7j/14j) + delta vs la période précédente de même longueur, et se déplie en sous-écran (calendrier/graphique/liste d'entrées).
  - nombre de réveils nocturnes = entrées sommeil dont l'heure de début tombe dans la plage nuit du bébé (`Baby.nighttimeHours`, section 6.8 — défaut `20:00–08:00` si non réglée).
  - nombre de couches par jour, tous types confondus (wet/dirty/both/dry, section 4).
- Courbe de croissance (poids/taille/périmètre crânien) : **implémenté** (courbes de percentiles OMS, écran `GrowthDetailPage`, voir note en tête de document) — 9 courbes de référence (2/5/10/25/50/75/90/95/98%, tables LMS OMS embarquées dans `src/lib/whoGrowthData.ts`) superposées à la courbe de l'enfant, points cliquables avec callout (date, valeur, percentile, âge, édition), bascule graphe/liste. Nécessite le sexe du bébé (section 4) ; si non renseigné, message invitant à le compléter dans Account > Family > (bébé) à la place du graphe. CDC non repris, OMS seul.
- **Calcul des agrégations côté client** (Firestore n'a pas de `GROUP BY` serveur) : récupérer les entrées de la période concernée et calculer moyennes/totaux en JavaScript. Aucun souci de perf à cette échelle (2 utilisateurs, peu de données).
- Lib graphique suggérée : Recharts. **Appliquer le skill `dataviz` du repo Claude Code au moment de l'implémentation** pour les couleurs/mise en forme.

## 8. Médicament & rappel (vitamine D)

- Saisie manuelle d'une prise (`medicationEntries`), comme une entrée nourriture/sommeil mais sans chrono (juste une heure de prise + dose optionnelle).
- UI de réglage du rappel : reprendre le patron de modale décrit en section 6.6 (bandeau lavande, une ligne "heure du rappel" éditable).
- **Alerte** : mécanisme = **Firebase Cloud Messaging (FCM)**, seul moyen d'avertir même app fermée/téléphone verrouillé (une simple bannière "pas encore fait aujourd'hui" à l'ouverture de l'app ne suffit pas pour une vraie alerte).
  - Une **Cloud Function programmée** (`onSchedule`, Cloud Scheduler) tourne chaque jour à l'heure définie dans `reminders.timeOfDay`. **Nécessite le plan Blaze** (voir section 0, point 6).
  - Elle vérifie s'il existe une `medicationEntries` du jour pour ce `babyId`/`medicationName`.
  - Si absent, elle envoie une notification **FCM** à tous les `fcmTokens` du foyer.
  - Le service worker du PWA doit gérer l'enregistrement du token FCM (demande de permission à l'installation) et l'affichage de la notification reçue — même brique technique que le bandeau persistant du chrono sommeil (section 6).

## 9. Import/export — format final : CSV (JSON abandonné)

- **Emplacement des boutons (fait, section 6.8)** : Export Data et Import Data sont sur l'écran **Child** (`ChildPage.tsx`, par bébé) ; `ExportImportSection` prend `householdId`/`baby` en props.
- **Export** : bouton dans l'app → parcourt les sous-collections Firestore d'un bébé et dump en **un seul CSV** côté client (pas besoin de Cloud Function à ce volume de données), colonne `category` en discriminant, une ligne par entrée toutes catégories mélangées. Format détaillé dans `docs/export-format.md`.
- **Import, en 2 étapes (UI)** : choisir le fichier (input file) puis cliquer sur un bouton **"Import"** séparé (désactivé tant qu'aucun fichier n'est choisi) — l'import ne se lance plus automatiquement à la sélection du fichier. Écriture batch dans Firestore (nouveaux ids systématiquement, pas de déduplication). L'import **détecte automatiquement le format** à l'en-tête et accepte deux formats :
  1. le format natif ci-dessus (round-trip export→import) ;
  2. **l'export RGPD réel de Nara** (récupéré et fourni par l'utilisatrice le 2026-09-22, fichier `export_narababy_malys_20260922.csv`, 1882 lignes) — colonnes `Type` + préfixes `[Bottle Feed]`/`[Sleep]`/`[Diaper]`/`[Growth]`/`[Solid Feed]`/`[Routine]`/`[Profile]`, avec conversion d'unités (KG/CM/OZ → g/mm/mL) et mapping vers nos catégories (ex. routine `Vitamin/Probiotic` → entrée médicament). Vérifié sur ce fichier réel : 1864 entrées importées, 18 lignes ignorées sans équivalent dans l'app (bain, ligne de métadonnées profil) — voir `docs/export-format.md` pour le détail des correspondances colonne par colonne.
- Documenter tout changement de format dans `docs/export-format.md` pour garder export et import synchronisés dans le temps.

## 10. Phasage (à traiter dans l'ordre)

✅ Toutes les phases 1-7 sont implémentées (état 2026-09-22, voir note en tête de document).

1. ✅ **Setup** (après Phase 0 uniquement) — dans cet ordre : `npm create vite@latest` (scaffold React+TS) → `npm install` → `firebase init` (Firestore + Auth) → Security Rules (section 4/12) → Auth à 2 comptes → création manuelle du household et des 2 membres. *(Auth en cours de migration vers Google Sign-In, voir section 1b et l'entrée 11 ci-dessous.)*
2. ✅ **Suivi nourriture + sommeil + couches** — formulaire de saisie instantanée (nourriture section 3, couches) + chrono start/stop (sommeil uniquement, section 6.4) avec bandeau persistant "en cours" (section 6.9), liste/timeline du jour, sélecteur de bébé (multi-bébé).
3. ✅ **Sync temps réel & offline** — `onSnapshot()`, cache persistant Firestore (section 5).
4. ✅ **Graphes & agrégations + croissance** — vues journalière et hebdo, agrégations côté client, courbe de croissance simple (section 7).
5. ✅ **Médicament & rappel** — saisie + passage au plan Blaze + Cloud Function programmée + FCM (section 8), en réutilisant le service worker déjà mis en place en phase 2. Reste manuel avant usage réel : upgrade Blaze + génération de la clé VAPID (voir `docs/notifications-setup.md`).
6. ✅ **Import/export** — section 9 (format final CSV, revu après la phase initiale — voir note en tête de document).
7. ✅ **Polish** — icônes/manifest PWA, réglages (profil bébé, unités).
8. ✅ **Fidélité UX post-lancement (hors phasage initial)** — refonte de History (calendrier hebdo + filtre par type, 6.5) et Trends (liste + delta + sous-écrans par métrique, 6.5b) à partir de vraies captures d'écran Nara ; ajout du 4e état de couche `dry` ; import CSV de l'export RGPD Nara réel (section 9).
9. ✅ **Courbes de percentiles OMS (hors phasage initial, anciennement notée extension v1.1)** — sexe du bébé, tables OMS LMS, écran `GrowthDetailPage` avec graphe de percentile et vue liste (section 7).
10. ✅ **Restructuration Account/Family/Child/Settings (hors phasage initial, 2026-09-23)** — voir section 6.8 : 4e onglet renommé Account, écrans séparés Family/Child/Add Child/Settings, Export/Import Data sur l'écran Child (section 9), Edit Activities fonctionnel (masque/affiche les cartes Activity, `useActivityVisibility`), Nighttime Hours implémenté (point 7 ci-dessous). Pas de "Stop Tracking" (décidé, hors scope v1).
11. 🟡 **Migration authentification vers Google Sign-In** (section 1b, repris de la PR #2 de Corentin) — **code fait** (2026-09-23) ; reste le déploiement manuel (4 étapes listées en 1b : activer Google dans la Console, déployer frontend puis règles dans cet ordre, connexion avec le compte partagé, nettoyage de l'ancien Email/Password).
12. ✅ **Onboarding "Create Family" (hors phasage initial, 2026-09-23)** — écran d'accueil pour créer le household + premier enfant à la première connexion, à la place d'un écran blanc. Voir note en tête de document.

## 11. Hors scope v1 (explicitement)

- Allaitement et tire-lait — retirés explicitement du scope nourriture.
- Grossesse, post-partum, vaccins, milestones, module médical général — proposés par Nara, non demandés.
- Courbes de percentiles CDC pour la croissance (OMS seul implémenté, voir section 7 et note en tête de document).
- Multi-foyer au-delà des 2 parents (nourrice, grands-parents, etc.).
- Résolution de conflits de sync avancée — dernier écrit gagne suffit à 2 utilisateurs.
- Auto-hébergement de la base — Firestore n'est pas exportable "comme du Postgres", accepté comme compromis (section 1).

## 12. Bonnes pratiques à suivre pendant l'implémentation

**Code — qualité**
- Une responsabilité par fonction/composant/hook : un `useSleepTimer()` dédié plutôt qu'un composant écran qui gère state, sync et affichage.
- Noms qui révèlent l'intention (`startFeedingTimer`, pas `handleClick2`) ; pas de commentaire pour compenser un mauvais nom.
- Pas de commentaires expliquant *quoi* — seulement *pourquoi*, quand c'est non évident (contrainte cachée, bug contourné).
- Code mort supprimé immédiatement, jamais commenté "au cas où" (git garde l'historique).
- Pas de généralité spéculative : pas de couche d'abstraction pour "si un jour on ajoute un 3e parent/backend" — ce sont 2 utilisateurs, 1-2 bébés, point.
- Guard clauses / retours anticipés plutôt que conditions imbriquées.
- Constantes nommées pour les valeurs magiques (`SLEEP_REMINDER_HOUR`, pas `8` en dur).

**Tests — couverture réelle du code**
- Viser une couverture significative (~80%) à la fois sur la logique métier (calcul de durée du chrono, agrégations/moyennes, percentile de croissance si implémenté) et sur les flux UI clés (démarrer/arrêter un chrono, saisir une entrée, sync).
- Configurer le seuil dans l'outil de test (`vitest --coverage`, `thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }` dans `vitest.config.ts`) pour que ce soit vérifié automatiquement, pas juste visé de mémoire.
- La couverture doit venir de tests qui vérifient un vrai comportement, pas de tests écrits juste pour faire monter le chiffre (pas de test qui appelle une fonction sans assertion utile).
- Tests de composants avec requêtes accessibles (`getByRole`) plutôt que `data-testid` — survivent aux refactos de markup.

**Sécurité des données (Firestore)**
- Security Rules deny-by-default, puis autoriser explicitement lecture/écriture seulement si `request.auth.uid` est dans `households/{id}.memberUids` **et** si l'email du token (`request.auth.token.email`) est dans l'allowlist en dur de `firestore.rules` (section 1b) — jamais laisser les règles en "mode test" (tout autorisé) après la mise en place initiale.
- Ne jamais compter uniquement sur des vérifications côté client : Firestore est appelé directement depuis l'app, donc le filtrage par foyer doit être imposé par les règles serveur.

**Accessibilité (coût faible, à faire dès le départ)**
- Chaque élément interactif (bouton start/stop chrono, entrée de timeline) = vraie balise `<button>`/sémantique avec libellé visible, jamais un `<div onClick>` stylé.
- Chaque champ de formulaire a un `<label>` associé, pas seulement un placeholder.
- États live (chrono en cours, sync en cours) en `aria-live` pour que ce soit annoncé, pas seulement visuel.

**Débogage**
- Cause racine avant correctif : reproduire le bug, lire le vrai message d'erreur/stack, comprendre la cause avant de changer du code — pas de corrections au hasard.
- Après ~3 correctifs infructueux sur le même problème, s'arrêter et remettre en question l'approche plutôt que d'empiler un 4e patch.

**Vérification avant de dire "c'est fait"**
- Ne jamais annoncer qu'une fonctionnalité "marche" sans l'avoir réellement exécutée (build, tests, ou vérif manuelle sur le déploiement Vercel) — pas de "ça devrait marcher".
- Avant de cocher une phase du plan comme terminée, repasser ses points un par un face à ce qui a été réellement construit.

**Git — allégé (projet à 2, pas d'entreprise)**
- Une branche par phase/fonctionnalité du plan, partant de `main`, petits commits.
- Pas de reviewer obligatoire, mais relire son propre diff comme un étranger le ferait avant de merger.
- Pas de pipeline CI à construire : les previews automatiques Vercel par branche suffisent déjà comme garde-fou "est-ce que ça build".