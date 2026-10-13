# Revue — Shell applicatif, pages Compte/Famille/Enfant, pages Pédiatre (préfixe APP)

Périmètre lu en entier : `src/App.tsx`, `src/main.tsx`, `index.html`, `src/vite-env.d.ts`, `src/index.css` (survol ciblé : variables, dark mode, safe-area, modal, menu photo, fab), `src/contexts/{Auth,Household}Context.tsx` (appelants), `src/components/{Layout,TabBar,BabySelector,Modal,EmptyState,ChildPhotoEditor,PhotoCropModal,NewVisitButton,NewVisitModal,VisitItemEditorModal}.tsx`, `src/pages/{Login,CreateFamily,Account,AccountSettings,Family,AddChild,Child,EditActivities,NighttimeHours,Pediatrician,PediatricianHistory,PediatricianVisit,VisitDiscussion,VisitRemarks}Page.tsx`, `src/hooks/{useCurrentVisit,usePediatricianVisits}.ts`, `src/lib/{photoCrop,photoExport,upcomingVisits,visitDate,visitItems}.ts`, `src/repositories/pediatricianVisits.ts` (côté usage), et tous les tests associés (`App.test.tsx`, `Layout/TabBar/BabySelector/Modal/ChildPhotoEditor.test.tsx`, tests des pages, `Pediatrician.test.tsx`, `photoCrop.test.ts`, `visitDate.test.ts`). Fichiers consultés hors périmètre pour vérifier : `households.ts`, `babies.ts`, `firebase.ts`, `babyExport.ts` (`deleteBabyWithData`), `firestoreBatch.ts`, `useActivityVisibility.ts`, `vaccineNotification.ts`, `foregroundPush.ts`, `sw.ts`, `aggregations.ts`, `firestore.rules`, `vercel.json`, `vite.config.ts`.

---

### [APP-01] Un snapshot « vide depuis le cache » affiche l'onboarding « Create Family » à une famille existante (risque de doublon de household)
- **Sévérité** : Haute
- **Catégorie** : robustesse
- **Fichier(s)** : `src/App.tsx:73`, `src/contexts/HouseholdContext.tsx:592-600`, `src/repositories/households.ts:26-44`, `src/lib/firebase.ts:69-71`, `src/pages/CreateFamilyPage.tsx:77-83`
- **Constat** : Firestore est initialisé avec `persistentLocalCache` (`firebase.ts:69-71`). Avec la persistance, `onSnapshot` sur la requête `households where memberUids array-contains uid limit 1` livre un premier snapshot **depuis le cache** (`metadata.fromCache === true`) dès que le client se considère hors ligne (démarrage dans un tunnel/mode avion, backoff réseau) — et sur un appareil neuf ou après « effacer les données du site » ce cache est vide. `households.ts:29-33` traduit alors « 0 doc » en `onChange(null)`, `HouseholdContext` passe `loading=false` avec `household=null`, et `App.tsx:73` affiche `CreateFamilyPage` (« Welcome to Baby Tracker — Add your first child ») à un parent qui a déjà une famille. S'il saisit un enfant, `createHousehold` crée un **second** household pour le même uid ; comme la souscription fait `limit(1)` sans tri, l'app pourra ensuite ouvrir au hasard l'un ou l'autre household : les données « disparaissent ». Aucun endroit du code ne consulte `fromCache` (grep `fromCache|getDocsFromServer` : 0 résultat hors tests).
- **Impact** : nouveau téléphone / données de site effacées + réseau faible → écran d'onboarding trompeur ; un clic suffit à dupliquer la famille, et le choix `limit(1)` rend le bug intermittent et très difficile à comprendre pour l'utilisateur.
- **Solution proposée** : (1) dans `subscribeToHouseholdForUser`, ne pas conclure « pas de household » sur un snapshot vide venant du cache : `if (snapshot.empty && snapshot.metadata.fromCache) return` (rester en chargement) — et exposer l'état « hors ligne » au contexte si besoin ; (2) dans `CreateFamilyPage.handleSubmit`, sécuriser côté client avant `createHousehold` : `const existing = await getDocsFromServer(query(householdsCollection(), where('memberUids','array-contains', user.uid), limit(1))); if (!existing.empty) return` (le listener prendra le relais) ; (3) `LoadingScreen` (déjà doté d'un timeout 8 s) peut afficher « Vous semblez hors ligne » au lieu de laisser basculer vers l'onboarding. Test : dans `HouseholdContext.test.tsx`, simuler `onChange(null)` issu d'un snapshot `fromCache` (adapter le mock pour passer `{ empty: true, metadata: { fromCache: true } }` ou tester directement `households.ts` avec un `onSnapshot` mocké) et vérifier que `loading` reste `true` / que `household` n'est pas annoncé `null`.
- **Complexité du fix** : M
- **Confiance** : Moyenne (comportement Firestore « snapshot vide fromCache quand hors ligne » connu et documenté, mais non reproduit ici ; le point (2) est en tout cas une protection indépendante et peu coûteuse)

---

### [APP-02] Aucun ErrorBoundary : toute exception de rendu = écran blanc définitif
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/App.tsx:116-122`, `src/main.tsx:134-138`, `src/lib/visitDate.ts:292-301`
- **Constat** : grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` dans `src/` : aucun résultat. Avec React 19, une exception pendant un rendu démonte tout l'arbre sous `createRoot` : la PWA affiche une page blanche sans bouton, jusqu'à un rechargement manuel (en mode standalone iOS, l'utilisateur n'a même pas de barre d'adresse). Exemple concret dans le périmètre : `formatVisitDate` construit `new Date(Date.UTC(NaN…))` si `visit.date` n'est pas `YYYY-MM-DD`, et `Intl.DateTimeFormat#format` lève alors un `RangeError: Invalid time value` ; `formatAge` et `formatHeaderDate` ont le même profil pour un `birthDate` corrompu.
- **Impact** : une seule donnée malformée (doc édité à la main dans la console, import futur, bug d'un autre écran) ou un bug de rendu transitoire rend l'app inutilisable pour les deux parents jusqu'au reload, sans message.
- **Solution proposée** : ajouter un composant `AppErrorBoundary` (classe avec `static getDerivedStateFromError` + `componentDidCatch` → `console.error`) qui rend `<main><h1>Baby Tracker</h1><p role="alert">Something went wrong.</p><button onClick={() => location.reload()}>Reload</button></main>`, l'envelopper autour de `<AppShell />` dans `App.tsx` et, idéalement, un second autour de `<Outlet />` dans `Layout.tsx` (pour garder header + tab bar). En complément, rendre `formatVisitDate` tolérant : `if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value`. Tests : `App.test.tsx` → un enfant qui `throw` affiche le fallback ; `visitDate.test.ts` → `formatVisitDate('garbage')` ne lève pas.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-03] Remarks / discussions : écriture du tableau entier → perte silencieuse d'une modification concurrente (2 téléphones)
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/pages/VisitRemarksPage.tsx:347,384-395`, `src/pages/VisitDiscussionPage.tsx:265-266,306-319`, `src/components/VisitItemEditorModal.tsx:159-167`, `src/repositories/pediatricianVisits.ts:375-382`
- **Constat** : chaque ajout/édition/suppression recalcule le tableau complet à partir du `visit.remarks` (ou `discussions`) connu localement, puis `updateDoc(..., { remarks })` **remplace** le champ. Les deux parents sont précisément ensemble chez le pédiatre, chacun sur son téléphone : si A ajoute une remarque pendant que B en a une en cours d'édition (ou que B est hors ligne quelques secondes — écriture mise en file par la persistance), la dernière écriture gagne et la remarque de l'autre disparaît sans erreur. L'autosave au démontage (`VisitItemEditorModal:159-167`) aggrave le cas : il écrit un tableau capturé au dernier rendu, potentiellement vieux de plusieurs secondes (téléphone en poche, geste retour). Les ids sont bien uniques (`crypto.randomUUID`) et l'ordre est conservé (ajout en fin), ce n'est pas le problème.
- **Impact** : perte de notes prises pendant une consultation (données non reconstituables), sans aucun signal.
- **Solution proposée** : remplacer l'écrasement du champ par une mutation **par item** dans une transaction, dans `pediatricianVisits.ts` : `export async function mutateVisitItems<T extends {id:string}>(householdId, babyId, visitId, field: 'remarks'|'discussions', mutate: (items: T[]) => T[])` qui fait `runTransaction(db, async tx => { const snap = await tx.get(ref); const items = (snap.data()?.[field] ?? []) as T[]; tx.update(ref, { [field]: mutate(items) }) })`. Les pages passent alors des lambdas : ajout `items => [...items, newItem]`, édition `items => items.map(i => i.id === id ? {...i, text} : i)`, suppression `items => items.filter(i => i.id !== id)` — ainsi une édition concurrente d'un *autre* item n'est plus écrasée. (Alternative plus simple pour l'ajout seul : `arrayUnion(newItem)`.) Test : dans `Pediatrician.test.tsx`, mocker `mutateVisitItems` et vérifier que la lambda appliquée à un tableau « serveur » contenant une remarque inconnue localement la conserve.
- **Complexité du fix** : M
- **Confiance** : Haute

---

### [APP-04] ChildPage : le formulaire est réinitialisé à chaque snapshot `babies` (perte des modifications en cours)
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/pages/ChildPage.tsx:82,90-96`, `src/repositories/babies.ts:12-30`
- **Constat** : `baby` est recalculé par `babies.find(...)` à chaque rendu ; `subscribeToBabies` reconstruit de nouveaux objets à chaque snapshot (`babies.ts:16-26`), donc l'identité de `baby` change dès qu'un doc de la collection bouge. L'effet `useEffect(..., [baby])` (l.90-96) réécrit alors `name`, `birthDate`, `sex` avec les valeurs serveur et jette la saisie en cours. Scénario interne à l'écran : l'utilisateur corrige le prénom, puis tape la photo → `ChildPhotoEditor.handleSave` → `updateBabyPhoto` → snapshot → le prénom non enregistré est perdu. Idem si l'autre parent modifie un enfant (n'importe lequel du foyer) au même moment.
- **Impact** : saisie perdue sans avertissement sur l'écran de profil ; d'autant plus trompeur que « Save » ne donne aucun retour (cf. APP-06) — l'utilisateur ne sait pas si c'est lui ou l'app.
- **Solution proposée** : ne resynchroniser le formulaire que quand on change d'enfant : `useEffect(() => { if (baby) {...} }, [baby?.id])` (avec le commentaire eslint `react-hooks/exhaustive-deps` adapté) — ou mieux, initialiser l'état depuis `baby` via une clé de remontage : rendre `<ChildForm key={baby.id} baby={baby} …/>` et passer `useState(baby.name)` sans effet. Test (`ChildPage.test.tsx`) : taper un nouveau prénom, `rerender` avec un `babies` dont l'objet a une nouvelle identité (`{ ...baby, photoDataUrl: 'data:…' }`), vérifier que le champ garde la saisie.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-05] CreateFamilyPage : aucune gestion d'erreur, bouton bloqué « disabled » pour toujours, household orphelin possible
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/pages/CreateFamilyPage.tsx:77-83,121-123`
- **Constat** : `handleSubmit` fait `setSubmitting(true)` puis `await createHousehold()` et `await addBaby()` sans `try/catch` ni `setSubmitting(false)`. En cas de rejet (règles Firestore — p. ex. uid non membre —, hors ligne prolongé, quota), la promesse est rejetée dans le vide (`void handleSubmit(...)` l.89), rien n'est affiché et le bouton « Add child » reste désactivé jusqu'au rechargement. Si `createHousehold` réussit mais `addBaby` échoue, le household existe sans enfant : la souscription bascule vers l'app principale avec `babies = []` et `ActivityPage` rend `null` (voir APP-07).
- **Impact** : premier contact avec l'app = écran figé sans explication ; cas « household sans enfant » = page Activity blanche.
- **Solution proposée** : envelopper dans `try { … } catch (error) { console.error('[family] creation failed', error); setError('Could not create your family. Check your connection and try again.') } finally { setSubmitting(false) }`, afficher `error` dans un `<p role="alert">`. Pour éviter le household orphelin, créer les deux docs dans un `writeBatch` (nouvelle fonction `createHouseholdWithBaby(uid, baby)` dans `households.ts` : `batch.set(doc(householdsCollection()), …); batch.set(doc(babiesCollection(householdRef.id)), …); await batch.commit()`). Tests : `createHousehold.mockRejectedValue(new Error('x'))` → alerte visible et bouton réactivé.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-06] AddChild / Child / NighttimeHours / ChildPhotoEditor : promesses non gérées, double soumission, aucun retour utilisateur
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `src/pages/AddChildPage.tsx:16-20,29-31`, `src/pages/ChildPage.tsx:100-104,132-134`, `src/pages/NighttimeHoursPage.tsx:278-281`, `src/components/ChildPhotoEditor.tsx:26-34`
- **Constat** : `AddChildPage` : `void addBaby(...).then(navigate)` sans `catch`, pas d'état `submitting`, bouton « Save » jamais désactivé → un double tap crée deux enfants (deux `addDoc`), et un échec laisse l'écran muet. `ChildPage.handleSubmit` : `void updateBaby(...)` sans `catch`, sans navigation ni message « Saved » — l'utilisateur ne sait pas si l'enregistrement a eu lieu (cf. APP-04). `NighttimeHoursPage` : `.then(navigate)` sans `catch`. `ChildPhotoEditor` : `void updateBabyPhoto(...)` ×2 sans `catch` (un data URL refusé par les règles ou un doc > 1 MiB échoue en silence). Seul `ChildPage.handleDeleteChild` gère correctement `deleting`/`deleteError` — c'est le modèle à généraliser.
- **Impact** : enfants en double, modifications perdues sans que l'utilisateur le sache, et `unhandledrejection` dans la console.
- **Solution proposée** : extraire un petit hook `useAsyncAction()` retournant `{ run, pending, error }` (`run = async fn => { if (pending) return; setPending(true); setError(null); try { await fn() } catch (e) { console.error(e); setError('Could not save. Try again.') } finally { setPending(false) } }`) et l'utiliser dans les 4 fichiers : bouton `disabled={pending}`, `<p role="alert">{error}</p>`. Pour `ChildPage`, naviguer vers `/account/family` après succès (comme `AddChildPage`) ou afficher un « Saved » éphémère. Tests : pour chaque page, `mockRejectedValue` → alerte visible, et un double clic sur « Save » → `addBaby` appelé une seule fois.
- **Complexité du fix** : M
- **Confiance** : Haute

---

### [APP-07] Foyer sans enfant (dernier enfant supprimé) : onglets Activity/History/Trends vides, sans état vide ni lien
- **Sévérité** : Moyenne
- **Catégorie** : ux
- **Fichier(s)** : `src/pages/ChildPage.tsx:115-116`, `src/pages/ActivityPage.tsx:145`, `src/components/Layout.tsx:45-75`, `src/components/BabySelector.tsx:143`
- **Constat** : `deleteBabyWithData` supprime l'enfant puis `navigate('/account/family')` — très bien. Mais si c'était le dernier enfant (ou après APP-05 cas « household sans bébé »), `babies = []`, `selectedBaby = null`, `BabySelector` rend `null` et `ActivityPage` rend `null` (l.145) : l'onglet Activity (écran d'accueil au prochain lancement) est un header avec un avatar vide et un `main` vide. `HistoryPage`/`TrendsPage` ont le même garde (grep `return null`). Aucun message « Add a child » n'est proposé, contrairement à `PediatricianHistoryPage:77` qui gère ce cas.
- **Impact** : après avoir supprimé l'unique enfant (ou créé une famille dont le `addBaby` a échoué), l'app ouvre sur un écran vide ; le chemin de sortie (Family → Children → Add child) n'est pas indiqué.
- **Solution proposée** : dans `Layout.tsx`, si `babies.length === 0`, rendre à la place de `<Outlet />` un `<EmptyState colorVar="--category-feeding" icon={<BabyAvatarIcon />}>No child yet. <Link to="/account/family/add">Add a child</Link></EmptyState>` sauf sur les routes `/account/*` (comparer `useLocation().pathname.startsWith('/account')`). Côté `ChildPage`, après suppression du dernier enfant, naviguer directement vers `/account/family/add`. Test `Layout.test.tsx` : `babies: []` → état vide avec lien ; `ChildPage.test.tsx` : suppression avec `babies.length === 1` → redirection `/account/family/add`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-08] Routage : pas de route 404, et `:babyId` invalide/supprimé rend une page blanche
- **Sévérité** : Moyenne
- **Catégorie** : ux
- **Fichier(s)** : `src/App.tsx:77-97`, `src/pages/ChildPage.tsx:98`, `src/pages/NighttimeHoursPage.tsx:274`, `src/pages/EditActivitiesPage.tsx:225-233`
- **Constat** : `<Routes>` n'a pas de `path="*"` : une URL inconnue (lien périmé, faute de frappe, ancienne notification) affiche le `Layout` avec un `main` vide. `ChildPage` et `NighttimeHoursPage` font `if (!baby) return null` : un `babyId` inconnu (enfant supprimé sur l'autre téléphone pendant qu'on est sur son écran, favori obsolète) donne la même page blanche, alors que les bébés sont garantis chargés à ce stade (`App.tsx:71` n'affiche les routes qu'après `loading=false`, qui n'arrive qu'après le premier snapshot `babies`). `EditActivitiesPage` ne vérifie pas du tout `babyId` : son bouton « Back » envoie vers `/account/family/<id inconnu>` → blanc. Les pages pédiatre, elles, redirigent correctement (`visit === null` → `<Navigate …/>`).
- **Impact** : écran vide sans issue autre que la tab bar ; l'utilisateur pense l'app cassée.
- **Solution proposée** : `App.tsx` : ajouter `<Route path="*" element={<Navigate to="/" replace />} />` dans le `Layout`. `ChildPage`/`NighttimeHoursPage`/`EditActivitiesPage` : remplacer `return null` par `return <Navigate to="/account/family" replace />` quand `household` existe mais pas `baby` (dans `EditActivitiesPage`, lire `babies` via `useHousehold` pour vérifier). Tests : `ChildPage.test.tsx` « renders nothing when the baby cannot be found » → remplacer par « redirects to the children list » ; `App.test.tsx` : rendre avec `window.history.pushState({}, '', '/nope')` et vérifier qu'on retombe sur Activity.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-09] Modal : l'effet dépend de `onClose` → re-focus du dialog (vol de focus) à chaque rendu du parent
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `src/components/Modal.tsx:197-204`, `src/components/NewVisitButton.tsx:17`, `src/components/Layout.tsx:73`, `src/pages/VisitRemarksPage.tsx:396`, `src/pages/VisitDiscussionPage.tsx:320`, `src/components/VisitItemEditorModal.tsx:142-154`
- **Constat** : `useEffect(() => { dialogRef.current?.focus(); … }, [onClose])` refait le focus sur le conteneur du dialog chaque fois que l'identité de `onClose` change. Or presque tous les appelants passent une lambda inline (`onClose={() => setCreating(false)}`, `onClose={() => setSummaryOpen(false)}`, …) : tout re-rendu du parent (snapshot `babies`/`visits`, tick d'horloge, contexte) arrache le focus au champ en cours de saisie — p. ex. le `<input type="date">` de `NewVisitModal` ouvert depuis `PediatricianVisitPage`, qui se re-rend à chaque snapshot des visites. `VisitItemEditorModal:142-154` a dû contourner le problème à la main (`useCallback` + `dirtyRef`), preuve que le bug est connu mais corrigé au mauvais endroit ; `PhotoCropModal` passe `onCancel` qui est lui aussi une lambda inline (`ChildPhotoEditor:96`).
- **Impact** : perte du focus/clavier en pleine saisie dans n'importe quelle modale dès qu'une donnée temps réel arrive ; comportement erratique difficile à reproduire.
- **Solution proposée** : dans `Modal.tsx`, séparer les deux responsabilités : `useEffect(() => { dialogRef.current?.focus() }, [])` (focus une seule fois au montage) et garder le `onClose` courant dans une ref : `const onCloseRef = useRef(onClose); useEffect(() => { onCloseRef.current = onClose }); useEffect(() => { const h = (e) => { if (e.key === 'Escape') onCloseRef.current() }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [])`. Ensuite, supprimer le contournement de `VisitItemEditorModal` (ou le garder, il devient inoffensif). Test `Modal.test.tsx` : focus un `<input>` enfant, `rerender` avec un nouveau `onClose`, vérifier `document.activeElement` inchangé.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-10] Modales : pas de piège de focus, pas de restitution du focus, pas de verrou de scroll ; menu photo sans Escape ni focus
- **Sévérité** : Basse
- **Catégorie** : a11y
- **Fichier(s)** : `src/components/Modal.tsx:206-249`, `src/components/ChildPhotoEditor.tsx:67-93`, `src/index.css:822-845`
- **Constat** : `Modal` pose `role="dialog" aria-modal="true"` et focalise le conteneur, mais Tab sort librement du dialog vers la page dimmée (pas de focus trap), le focus n'est pas rendu au bouton déclencheur à la fermeture, et `body` n'est pas verrouillé (`.modal-overlay` est `position: fixed` mais rien n'empêche le scroll de la page derrière — gênant sur iOS quand la modale est courte). Le menu « Change Child Photo » (`ChildPhotoEditor:68-92`) est un `role="dialog" aria-modal` sans aucune gestion de focus ni d'Escape ; la fermeture par clic sur l'overlay fonctionne mais pas au clavier.
- **Impact** : utilisation au clavier/lecteur d'écran incohérente ; scroll de fond parasite sur mobile.
- **Solution proposée** : dans `Modal`, (1) mémoriser `document.activeElement` au montage et le re-focaliser au démontage ; (2) ajouter `document.body.style.overflow = 'hidden'` au montage avec restauration ; (3) piège de focus minimal : sur `keydown Tab`, si `document.activeElement` est le premier/dernier focusable du dialog (`dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')`), boucler. Pour le menu photo, le migrer vers `Modal` (`closeOnOverlayClick`) ou dupliquer le handler Escape + focus initial. Test `Modal.test.tsx` : après fermeture, `document.activeElement` est le bouton d'origine.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-11] Id DOM `visit-date` dupliqué quand « New Visit » est ouvert depuis l'écran d'une visite
- **Sévérité** : Basse
- **Catégorie** : a11y
- **Fichier(s)** : `src/components/NewVisitModal.tsx:85-92`, `src/pages/PediatricianVisitPage.tsx:161-168`
- **Constat** : `PediatricianVisitPage` rend `<input id="visit-date">` et `NewVisitButton` (l.237) monte `NewVisitModal` dans le même arbre, qui rend aussi `<label htmlFor="visit-date">` + `<input id="visit-date">`. Deux éléments portent le même id ; `label.htmlFor` du modal se résout sur le **premier** `#visit-date` du document, c'est-à-dire le champ de la page derrière l'overlay. Toucher le libellé « Date » dans la modale focalise/ouvre le date-picker du champ caché, et les lecteurs d'écran annoncent le mauvais champ. Le test passe parce que `within(dialog).getByLabelText` limite la recherche au dialog.
- **Impact** : date-picker qui s'ouvre « hors » de la modale sur mobile en tapant le libellé ; étiquetage a11y incorrect.
- **Solution proposée** : renommer dans `NewVisitModal` `id="new-visit-date"` / `htmlFor="new-visit-date"`. Test `Pediatrician.test.tsx` « closes the new visit popup when created from another visit » : ajouter `expect(document.querySelectorAll('#visit-date')).toHaveLength(1)`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-12] Suppression d'une visite : double navigation (snapshot optimiste puis `.then`) et aucune gestion d'erreur
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/pages/PediatricianVisitPage.tsx:142-147,118`
- **Constat** : `deleteDoc` déclenche immédiatement un snapshot local (latence compensée) → `visit` devient `null` → l.118 rend `<Navigate to="/account/pediatrician" replace />` → `PediatricianPage` redirige vers la **prochaine visite à venir** (ou l'historique). Puis, quand le serveur acquitte, le `.then` de l.144 navigue (replace) vers `/account/pediatrician/history`. En ligne : l'écran saute brièvement sur une autre visite avant d'atterrir sur l'historique. Hors ligne : la promesse ne se résout pas, l'utilisateur reste sur la visite « suivante » sans comprendre. Pas de `catch` : une suppression refusée est silencieuse (la visite réapparaît).
- **Impact** : navigation saccadée/incohérente après « Delete visit », erreur invisible.
- **Solution proposée** : naviguer **avant** la suppression (`navigate('/account/pediatrician/history', { replace: true })` puis `void deletePediatricianVisit(...).catch(err => { console.error(err); window.alert('Could not delete this visit.') })`), ce qui évite la course avec `<Navigate>`. Test : ajouter dans `Pediatrician.test.tsx` un cas « deletes the visit after confirmation and lands on the history » (actuellement `deletePediatricianVisit` n'est mocké que pour exister, aucun test ne l'exerce).
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-13] `usePediatricianVisits` sans chemin d'erreur : `PediatricianPage` reste `null` indéfiniment
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/hooks/usePediatricianVisits.ts:267-274`, `src/pages/PediatricianPage.tsx:12`, `src/repositories/pediatricianVisits.ts:344-354`
- **Constat** : `subscribeToPediatricianVisits` n'accepte pas de callback d'erreur et le hook n'en expose pas ; si `onSnapshot` échoue (règles, index manquant après un futur `where`, réseau coupé avant tout cache), `visits` reste `null` pour toujours. `PediatricianPage:12` fait `if (visits === null) return null` → `Family > Pediatrician` affiche un écran vide, avec la tab bar « pédiatre » (Activity/History/Family) et sans retour en arrière évident (le `Back` est dans les pages filles).
- **Impact** : écran vide sans diagnostic ; l'utilisateur ne peut que changer d'onglet.
- **Solution proposée** : ajouter un `onError` au repository (`onSnapshot(q, next, error => onError?.(error))`), faire retourner au hook `{ visits, error }` et dans `PediatricianPage` afficher `<p role="alert">Unable to load visits ({error.message})</p>` avec un lien « Back » vers `/account` ; afficher aussi un `LoadingScreen`/spinner au lieu de `null` tant que `visits === null`. Test : mock `subscribeToPediatricianVisits` appelant `onError(new Error('x'))` → alerte visible.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-14] NighttimeHours : aucune validation (`start === end` désactive toute la détection de nuit)
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/pages/NighttimeHoursPage.tsx:278-281`, `src/lib/aggregations.ts:13-19`
- **Constat** : le formulaire accepte n'importe quel couple From/To. Avec `start === end` (p. ex. « 20:00 – 20:00 »), `isDuringNight` évalue `start <= end ? at >= start && at < end : …` → toujours `false` : plus aucun réveil nocturne compté, et `activityWindowStart` démarre la fenêtre « since last night » à la même heure la veille (fenêtre de 24 h, cohérent mais trompeur). Aucun message n'avertit l'utilisateur.
- **Impact** : stats de nuit à zéro sans explication après une mauvaise manipulation des sélecteurs.
- **Solution proposée** : dans `handleSubmit`, `if (start === end) { setError('Nighttime must last at least one hour.'); return }` (ou désactiver « Save » dans ce cas) ; optionnel : exiger une durée ≥ 60 min via `minutesOf`. Test `NighttimeHoursPage.test.tsx` : régler From=To → `updateNighttimeHours` non appelé et alerte visible.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-15] LoginPage : bouton Google sans état « en cours » (double clic → faux message d'erreur) et `role="alert"` + `aria-live="polite"` contradictoires
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/pages/LoginPage.tsx:23-25,56-58`, `src/contexts/AuthContext.tsx:368-376`
- **Constat** : « Sign in with Google » n'est jamais désactivé ; un second tap pendant que la popup s'ouvre déclenche un second `signInWithPopup`, qui annule le premier avec `auth/cancelled-popup-request` → `AuthContext` affiche « Unable to sign in with Google. » alors que la popup restante aboutit. Par ailleurs `<p role="alert" aria-live="polite">` : `role="alert"` implique `aria-live="assertive"` ; l'attribut explicite `polite` est contradictoire (comportement dépendant du lecteur d'écran) et l'élément est rendu même vide.
- **Impact** : message d'erreur trompeur sur un double tap (fréquent sur mobile) ; annonce a11y incohérente.
- **Solution proposée** : `const [signingIn, setSigningIn] = useState(false)` autour de `loginWithGoogle` (`disabled={signingIn}`), et dans `AuthContext.loginWithGoogle` ignorer les codes `auth/cancelled-popup-request` et `auth/popup-closed-by-user` (pas une erreur à afficher). Remplacer par `{error && <p role="alert">{error}</p>}`. Test `LoginPage.test.tsx` : le bouton est `disabled` pendant la promesse en attente ; `AuthContext.test.tsx` : rejet `{ code: 'auth/popup-closed-by-user' }` → pas d'erreur affichée.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-16] PhotoCropModal : zoom à la molette fait aussi défiler la page ; orientation EXIF non maîtrisée explicitement
- **Sévérité** : Basse
- **Catégorie** : ux
- **Fichier(s)** : `src/components/PhotoCropModal.tsx:179-181,209`, `src/lib/photoExport.ts:302-310`
- **Constat** : `onWheel` React est enregistré en écouteur passif : impossible d'appeler `preventDefault`, donc sur desktop la molette zoome **et** fait défiler le `.modal-dialog` (`overflow-y: auto`) / la page. Pour l'EXIF : le recadrage repose sur le fait que `naturalWidth/Height` et `drawImage` appliquent l'orientation EXIF (comportement par défaut `image-orientation: from-image` des navigateurs récents, iOS ≥ 13.4) ; aucun garde-fou ni test, et une photo portrait prise sur un vieil Android pourrait sortir tournée. Points positifs vérifiés : l'ObjectURL est bien révoqué dans le cleanup, `touch-action: none` est posé sur le viewport, le canvas de sortie fait 320×320 (≈20-40 KB, loin de la limite 1 MiB du doc), `toDataURL` sur une blob URL same-origin ne « taint » pas le canvas.
- **Impact** : expérience desktop dégradée (scroll parasite) ; risque résiduel de photo tournée sur de vieux appareils.
- **Solution proposée** : attacher le wheel en natif : `useEffect(() => { const el = viewportRef.current; const h = (e: WheelEvent) => { e.preventDefault(); applyZoomRef.current(...) }; el?.addEventListener('wheel', h, { passive: false }); return () => el?.removeEventListener('wheel', h) }, [])`. Pour l'EXIF, préférer `createImageBitmap(file, { imageOrientation: 'from-image' })` quand disponible et dessiner ce bitmap (fallback `<img>` sinon), ou ajouter `img { image-orientation: from-image }` explicitement dans `.photo-crop-viewport img`. Test : non triviaux en jsdom ; au minimum un test que `exportCroppedPhoto` lève proprement quand `getContext` retourne `null` (chemin `catch` de `handleSave`, aujourd'hui non couvert).
- **Complexité du fix** : S
- **Confiance** : Moyenne (orientation EXIF : dépend des navigateurs cibles, non reproduit ici)

---

### [APP-17] Couverture de tests : chemins d'erreur et cas limites non testés sur l'ensemble du périmètre
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `src/pages/Pediatrician.test.tsx`, `src/pages/ChildPage.test.tsx`, `src/pages/AddChildPage.test.tsx`, `src/pages/CreateFamilyPage.test.tsx`, `src/components/ChildPhotoEditor.test.tsx`, `src/components/Modal.test.tsx`, `src/App.test.tsx`, `src/components/Layout.test.tsx`
- **Constat** : aucun test ne couvre un rejet de promesse (`addBaby`, `updateBaby`, `createHousehold`, `updateBabyPhoto`, `updatePediatricianVisit`, `deletePediatricianVisit` — ce dernier n'est même jamais exercé) ; `ChildPage` ne teste pas l'échec de suppression (`deleteError`) ni la perte de saisie sur snapshot (APP-04) ; `Pediatrician.test.tsx` ne teste ni la suppression d'une remarque/question via « Delete » dans l'éditeur, ni le changement de date (`setDate`), ni la bascule Vaccine Yes→No, ni `useCurrentVisit` avec un `?baby=` inconnu ; `PhotoCropModal` : ni `onError` de l'image, ni le `catch` de `handleSave`, ni le pinch à deux pointeurs ; `Modal` : ni le focus initial, ni l'absence de re-focus (APP-09) ; `App.test.tsx` : ni l'écran d'erreur household, ni le « Sign out » du `LoadingScreen` après 8 s (`STUCK_LOADING_MS`), ni la route inconnue ; `Layout.test.tsx` : pas de test du message `navigate` du service worker (`Layout.tsx:23-31`), qui est pourtant le seul chemin d'ouverture des notifications. À noter aussi : `Pediatrician.test.tsx` appelle `vi.useRealTimers()` avant les assertions mais après le rendu, ce qui fonctionne mais rend les tests dépendants de l'ordre d'exécution si un effet asynchrone lit `Date` plus tard.
- **Impact** : les bugs APP-03/04/05/06/09/12 passent tous la suite actuelle.
- **Solution proposée** : ajouter au minimum, par page, un test « rejet → alerte + bouton réactivé » (avec `mockRejectedValue`), un test « delete visit » et « delete remark » dans `Pediatrician.test.tsx`, un test `Layout` qui dispatch `new MessageEvent('message', { data: { type: 'navigate', url: '/history' } })` sur `navigator.serviceWorker` (mock) et vérifie le changement de route, et un test `App` avec `vi.useFakeTimers()` avançant de 8 s pour le bouton « Sign out ». Encadrer les faux timers par `try/finally` ou `afterEach(() => vi.useRealTimers())`.
- **Complexité du fix** : M
- **Confiance** : Haute

---

### [APP-18] HouseholdContext : la souscription `babies` est recréée à chaque snapshot du household
- **Sévérité** : Nit
- **Catégorie** : perf
- **Fichier(s)** : `src/contexts/HouseholdContext.tsx:609-623`
- **Constat** : `useEffect(..., [household])` dépend de l'objet `household`, reconstruit à chaque snapshot (`households.ts:35-39`). Toute modification du doc household (rare aujourd'hui : `name`, `memberUids`) désabonne/réabonne `subscribeToBabies` et provoque un re-render en cascade. Sans impact fonctionnel actuel, mais c'est le même piège qu'APP-04.
- **Impact** : aucun aujourd'hui ; coût et flash potentiel si le household devient plus dynamique.
- **Solution proposée** : `const householdId = household?.id ?? null` et `useEffect(..., [householdId])`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-19] `newItemId` dépend de `crypto.randomUUID` (contexte sécurisé uniquement)
- **Sévérité** : Nit
- **Catégorie** : robustesse
- **Fichier(s)** : `src/lib/visitItems.ts:303-305`
- **Constat** : `crypto.randomUUID` n'existe que dans un contexte sécurisé (HTTPS ou `localhost`). En prod (Vercel) et en dev sur `localhost` c'est bon ; mais tester l'app depuis un téléphone sur le LAN (`http://192.168.x.x:5173`, cas classique pour tester le crop photo ou les notifications) fait planter « Add remark » avec `TypeError: crypto.randomUUID is not a function` (et sans ErrorBoundary — APP-02 — c'est un écran blanc).
- **Impact** : limité au dev/test sur réseau local.
- **Solution proposée** : `return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : \`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}\``. Test unitaire `visitItems.test.ts` (absent aujourd'hui) couvrant le fallback via `vi.stubGlobal('crypto', {})`.
- **Complexité du fix** : S
- **Confiance** : Haute

---

### [APP-20] Petites incohérences a11y/UX : double titre « Children », Edit Activities « par enfant » mais stocké par appareil, allowlist dupliquée
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/pages/FamilyPage.tsx:215,219`, `src/pages/EditActivitiesPage.tsx:225-233`, `src/hooks/useActivityVisibility.ts:3`, `src/contexts/AuthContext.tsx:322`, `firestore.rules:6-9`
- **Constat** : (a) `FamilyPage` rend deux `<h2>Children</h2>` consécutifs (en-tête + section) : redondant pour les lecteurs d'écran. (b) La route `/account/family/:babyId/activities` et le libellé « Edit Activities » dans la fiche d'un enfant suggèrent un réglage par enfant et partagé ; en réalité `useActivityVisibility` stocke une liste unique dans `localStorage` de l'appareil : pas par enfant, pas synchronisé entre les deux téléphones des parents (choix documenté dans `plan.md`, mais l'UI ne le dit pas). (c) `ALLOWED_EMAILS` est dupliqué entre `AuthContext.tsx` et `firestore.rules` sans test ni commentaire croisé : un ajout d'email dans un seul des deux donne soit un refus client, soit un refus Firestore silencieux.
- **Impact** : confusion mineure ; divergence possible lors d'un futur ajout d'adresse.
- **Solution proposée** : (a) transformer le second `<h2>` en `<h3>` ou le retirer (la section a déjà `aria-label="Children"`). (b) Compléter le `hint` de `EditActivitiesPage` : « This setting is saved on this device only. » ou, si la synchronisation est souhaitée, persister `hiddenActivities` sur le doc household. (c) Ajouter un commentaire réciproque dans les deux fichiers (« keep in sync with … ») et un test qui lit `firestore.rules` et vérifie que chaque email d'`ALLOWED_EMAILS` y figure.
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- Garde d'authentification propre : pas de flash de `LoginPage` ni de `CreateFamilyPage` (`loading` ne passe à `false` qu'après le premier snapshot `babies`), `LoadingScreen` avec sortie de secours après 8 s, gestion des erreurs de listener Auth et Household, refus client des emails hors allowlist.
- `VisitItemEditorModal` est soigné : trim, Save désactivé si vide, confirmation de perte, autosave au démontage (geste retour) avec `settledRef` pour éviter les doubles écritures ; `NewVisitModal` protège contre la double soumission.
- `PhotoCropModal`/`photoCrop.ts` : maths de recadrage testées, ObjectURL révoqué, `touch-action: none`, sortie 320×320 JPEG légère — le stockage en data URL sur le doc est un compromis assumé et dimensionné.
- Routage pédiatre défensif (`visit === null` → redirection, `switching` pour le `?baby=` des notifications, clé de souscription pour ignorer les visites de l'enfant précédent) ; `TabBar` contextuel avec `aria-current`.
- CSS : variables centralisées, dark mode via `prefers-color-scheme` avec `color-scheme`, `env(safe-area-inset-*)` sur header/tab bar/modales/FAB, `#root` borné à 480 px.

## Zones non couvertes
- `src/index.css` n'a été lu que par sections ciblées (≈ 500 lignes sur 2386) : pas de revue exhaustive du contraste ni des media queries des autres écrans.
- Le comportement Firestore « snapshot vide depuis le cache quand hors ligne » (APP-01) et l'orientation EXIF (APP-16) n'ont pas été reproduits (revue statique, pas d'exécution de l'app).
- `vite-plugin-pwa` : je n'ai pas vérifié si le plugin injecte les meta `apple-mobile-web-app-*` dans `index.html` (absentes du source) ; si ce n'est pas le cas, l'app en « standalone » iOS n'aura pas la barre de statut translucide attendue — à confirmer dans le `dist/index.html` généré.
