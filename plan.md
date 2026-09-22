# baby-tracker — plan d'implémentation

> Document destiné à être donné à une autre instance Claude pour l'implémentation.
> Contexte : l'app "Nara Baby & Mom Tracker" (utilisée quotidiennement par les deux parents) est jugée trop chère/verrouillée par l'utilisatrice.
> Objectif : une app de remplacement perso, réservée à 2 parents, dont **l'UX doit coller à celle de Nara** (voir section 6 — patrons d'écrans détaillés, ne pas re-rechercher) pour ne pas casser les habitudes déjà prises.

> **Note de recherche (confirmée)** : app identifiée = *Nara Baby & Pregnancy Tracker* (App Store, id1444639029) alias "Nara Baby & Mom Tracker" sur nara.com, éditeur Nara Organics, Inc. (US), en anglais uniquement, aucune version française. Paywall freemium + achats intégrés/abonnement **déjà actif**, pas "à venir" (confirmé via la fiche App Store : "Free with in-app purchases").

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
4. Menu **Build → Authentication → Get started** → activer la méthode "E-mail/Mot de passe".
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
- **Auth** : minimal — Firebase Authentication, 2 comptes email (les deux parents), pas de signup public, pas de gestion multi-foyers généralisée.
- **Repo** : `~/project/baby-tracker` (créé, vide pour l'instant).

## 2. Fonctionnalités demandées (confirmées par l'utilisatrice)

1. **Import/export** des données, y compris **import des données existantes issues de Nara** une fois récupérées (voir section 9 — action requise côté utilisatrice, pas de bouton export connu dans Nara).
2. **Suivi nourriture** : saisie rapide (heure + quantité/type), **pas de chrono** — voir section 3 pour le détail biberon/solide.
3. **Suivi sommeil** avec chrono (comme Nara), avec un minuteur affiché en permanence pendant que le suivi est actif — bandeau/popup persistant montrant le temps écoulé. Pattern jugé très utile dans Nara, à reproduire (détails UX en section 6). C'est le seul type d'entrée qui a un état "en cours" (sommeil ; voir section 3 pour pourquoi la nourriture n'en a pas).
4. **Visualisation graphique** : courbes, **moyennes et agrégations** des données (ex : durée moyenne de sommeil/jour et /semaine, nombre et volume de biberons par jour). Détails en section 7.
5. **Synchronisation** entre les téléphones des deux parents, en quasi temps réel (si un parent lance un chrono, l'autre doit le voir immédiatement).
6. **Suivi médicament** (ex : vitamine D) **avec rappel/alerte** si la prise du jour n'a pas été enregistrée. Détails en section 8.
7. **Plusieurs bébés** dans le même foyer (ex : plusieurs enfants) — sélecteur de bébé dans l'app, chaque écran/graph filtré sur le bébé sélectionné.
8. **Courbes de croissance** (poids/taille) — voir sections 4 et 7.
9. **Suivi couches** (pipi/caca/les deux) — voir section 4.

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
  name, memberUids: [uid1, uid2]

households/{householdId}/babies/{babyId}
  name, birthDate

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
  type: "pee" | "poop" | "both"
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

- **Security Rules** : deny-by-default en tête de fichier, puis autoriser lecture/écriture uniquement si `request.auth.uid` figure dans `households/{householdId}.memberUids` (voir section 12, principe repris de l'access-control interne).
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

### 6.2 Écran d'accueil ("Activity")
- En-tête : avatar rond illustré du bébé + son nom + petit chevron ⌵ (tap = sélecteur multi-bébé, 6.7) + date du jour, à gauche ; deux boutons pilule à droite (notes, "…").
- Une carte empilée par catégorie (Nourriture, Sommeil, Croissance, Médicament, Couches). Chaque carte = bandeau de couleur (6.1) avec le nom de la catégorie à gauche et un bouton "+" rond (fond marine, "+" blanc) à droite pour ajouter une entrée ; en dessous, la dernière entrée sur une ligne (icône + libellé + heure relative "2h 10m ago" + valeur si pertinent + chevron) et un lien "Show more" pour déplier l'historique récent sans changer d'écran.

### 6.3 Navigation
Barre d'onglets en bas. Nara a 5 entrées (Activity, History, Trends, Shop, Family) ; pour cette app sans marketplace, garder 4 : **Activity, History, Trends, Family**. Onglet actif en marine avec un trait sous l'icône, inactifs en gris clair.

### 6.4 Chrono sommeil — le point le plus demandé
Ne s'applique qu'au sommeil (biberon/solide utilisent le formulaire de saisie instantanée de la section 3, pas cette modale). Au tap sur "+" (ou sur l'entrée sommeil "en cours"), une **modale plein écran** s'ouvre :
- bandeau de couleur de la catégorie en haut : "X" (fermer) à gauche, nom de la catégorie centré, "Save" en gras à droite.
- corps blanc : "Total Time" centré, gros compteur live `HH:MM:SS`, bouton pilule orange "Stop Timer" juste en dessous.
- puis en liste : "Start Time" (éditable), "End Time" ("Add" tant que non arrêté), "Notes" (texte libre), bouton pilule "Add Photo" en bas.

**Nuance pour l'implémentation PWA** : ces captures montrent la modale *à l'ouverture*, pas un bandeau visible en permanence par-dessus les autres écrans. Sur iOS, Nara couvre ce besoin via les **Live Activities** (écran verrouillé/Dynamic Island), inutilisables depuis une PWA. Le choix déjà pris section 5 (bandeau persistant in-app + notification FCM avec le temps écoulé) reste donc le bon substitut — reprendre dans ce bandeau la même densité d'info que la modale (icône catégorie, compteur live, bouton stop) pour rester cohérent visuellement quand on rouvre la modale complète depuis le bandeau.

### 6.5 Historique ("History")
Vue calendrier hebdomadaire en haut (7 jours, jour courant en pastille marine pleine) ; en dessous, une timeline verticale par jour (une colonne par jour, heures 12AM→12AM sur l'axe de gauche), avec un bloc coloré par entrée positionné à son heure et dont la hauteur reflète la durée (couleur = catégorie, palette 6.1). C'est le rendu concret de la "vue journalière timeline" de la section 7 — en v1 un seul jour à la fois reste valide (non bloquant), la vue multi-colonnes/semaine est une amélioration naturelle une fois ça marche.

### 6.6 Réglages de rappel (patron à réutiliser section 8)
Même modale qu'en 6.4 mais fond crème : titre "Nap Reminders" (→ adapter en "Rappel [médicament]"), lignes de réglage en haut, puis une **liste verticale type stepper** — une icône par évènement programmé (soleil = réveil, lune/zzz = sieste, étoile = coucher) reliée par un connecteur vertical, champ heure éditable à droite de chaque ligne. Pour le rappel médicament (un seul horaire par médicament), une seule ligne de ce type suffit.

### 6.7 Sélecteur multi-bébé
Le chevron ⌵ à côté du nom du bébé en en-tête (6.2) ouvre le sélecteur de bébé — pattern à reprendre tel quel pour le point 7 de la section 2 : pas un écran séparé, une simple action sur l'en-tête existant.

### 6.8 Écran famille ("Family")
Liste groupée façon réglages iOS : sections "Children" / "Caregivers" (ignorer "Pregnancy", hors scope), chaque personne = une ligne (nom + méta, ex. âge) avec chevron, actions "Add child"/"Add caregiver" en lien marine gras en bas de section.

### 6.9 Notification/rappel en direct (complète 6.4)
En complément du bandeau persistant (6.4), une **notification système** ("Bébé dort depuis 14h32") via **FCM** permet de voir l'état sans ouvrir l'app — même brique technique que les rappels médicament (section 8), à construire une seule fois et réutiliser pour les deux usages.

### 6.10 Images de référence : décision prise — pas d'images dans le repo
Choix délibéré, pas un oubli : pas de captures Nara copiées dans le repo. Raisons — (1) ce sont des visuels propriétaires (App Store/marketing Nara), à éviter même dans un repo privé perso ; (2) une description écrite précise (6.1-6.8) coûte beaucoup moins de tokens à lire pour l'instance qui implémente qu'une image à faire analyser, et suffit pour une app perso (pas besoin de pixel-perfect). Si un doute subsiste sur un détail visuel précis en cours d'implémentation, redemander à l'utilisatrice plutôt que d'aller re-chercher les captures en ligne.

## 7. Graphes & agrégations

- Vue journalière "timeline" (comme Nara) : succession des entrées nourriture/sommeil/couches sur la journée.
- Vue stats agrégées (jour/semaine) :
  - durée totale et moyenne de sommeil,
  - nombre de biberons, volume total et moyen si suivi,
  - nombre de réveils nocturnes (déductible du nombre d'entrées sommeil sur la plage nuit),
  - nombre de couches (pipi/caca) par jour.
- Courbe de croissance (poids/taille/périmètre crânien) : ligne simple valeur/temps en v1. Nara affiche des courbes de percentiles OMS/CDC (fines lignes dorées, une par tranche 2/5/10/25/50/75/90/95/98%) avec la mesure réelle en ligne verte foncée à points cliquables (tooltip bandeau marine + détails, palette section 6.1) — reproductible mais nécessite d'embarquer les tables de référence OMS/CDC (LMS) ; à traiter comme **extension v1.1**, pas bloquant pour le lancement.
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

## 9. Import/export

- **Export** : bouton dans l'app → parcourt les sous-collections Firestore d'un bébé et dump en CSV/JSON côté client (pas besoin de Cloud Function à ce volume de données).
- **Import** : upload d'un fichier au même format (CSV/JSON) → écriture batch dans Firestore. Documenter le format dans `docs/export-format.md` pour garder export et import synchronisés dans le temps.
- Si l'utilisatrice récupère un export RGPD de Nara avant la bascule payante, prévoir un script d'import ponctuel adapté à ce format une fois qu'on le connaît (pas de développement générique tant que le format Nara n'est pas vu).

## 10. Phasage (à traiter dans l'ordre)

1. **Setup** (après Phase 0 uniquement) — dans cet ordre : `npm create vite@latest` (scaffold React+TS) → `npm install` → `firebase init` (Firestore + Auth) → Security Rules (section 4/12) → Auth à 2 comptes → création manuelle du household et des 2 membres.
2. **Suivi nourriture + sommeil + couches** — formulaire de saisie instantanée (nourriture section 3, couches) + chrono start/stop (sommeil uniquement, section 6.4) avec bandeau persistant "en cours" (section 6.9), liste/timeline du jour, sélecteur de bébé (multi-bébé).
3. **Sync temps réel & offline** — `onSnapshot()`, cache persistant Firestore (section 5).
4. **Graphes & agrégations + croissance** — vues journalière et hebdo, agrégations côté client, courbe de croissance simple (section 7).
5. **Médicament & rappel** — saisie + passage au plan Blaze + Cloud Function programmée + FCM (section 8), en réutilisant le service worker déjà mis en place en phase 2.
6. **Import/export** — section 9.
7. **Polish** — icônes/manifest PWA, réglages (profil bébé, unités).

## 11. Hors scope v1 (explicitement)

- Allaitement et tire-lait — retirés explicitement du scope nourriture.
- Grossesse, post-partum, vaccins, milestones, module médical général — proposés par Nara, non demandés.
- Courbes de percentiles OMS/CDC pour la croissance — extension v1.1 (voir section 7), v1 = courbe simple valeur/temps.
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
- Security Rules deny-by-default, puis autoriser explicitement lecture/écriture seulement si `request.auth.uid` est dans `households/{id}.memberUids` — jamais laisser les règles en "mode test" (tout autorisé) après la mise en place initiale.
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