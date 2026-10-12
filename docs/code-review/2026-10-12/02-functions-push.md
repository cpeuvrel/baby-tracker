# Revue 02 — Cloud Functions & notifications push (serveur + client)

Périmètre lu en entier : `functions/src/*.ts` (+ tests), `functions/package.json`, `functions/tsconfig.json`, `.github/workflows/deploy-functions.yml`, `docs/notifications-setup.md`, `src/lib/{messaging,pushRegistration,foregroundPush,sleepTimerNotification,vaccineNotification}.ts`, `src/hooks/{useSleepTimerNotification,useReminder}.ts`, `src/repositories/{fcmTokens,reminders}.ts`, `src/components/ReminderSettingsModal.tsx`, `src/sw.ts`, et leurs tests. Appelants vérifiés : `Layout.tsx`, `SleepTimerModal.tsx`, `NewVisitModal.tsx`, `PediatricianVisitPage.tsx`, `ActiveTimersBanner.tsx`, `ActivityPage.tsx`, `AuthContext.tsx`, repos `medicationEntries`/`sleepEntries`/`pediatricianVisits`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`, et le code du SDK `@firebase/messaging` (SW) dans `node_modules`. `npx vitest run --dir src` dans `functions/` : 20 tests passent.

---

### [FN-01] `hasMedicationToday` exige un index composite absent de `firestore.indexes.json` : le rappel médicament échoue (et fait planter tout le tick)
- **Sévérité** : Haute
- **Catégorie** : bug
- **Fichier(s)** : `functions/src/index.ts:33-38`, `firestore.indexes.json:1-4`, `.github/workflows/deploy-functions.yml:40`, `docs/notifications-setup.md:30`
- **Constat** : la requête `where('name', '==', medicationName).where('givenAt', '>=', …)` combine une égalité et une inégalité sur deux champs différents d'une même collection : Firestore exige un index composite `(name ASC, givenAt ASC)` pour ce cas, les index mono-champ automatiques ne suffisent pas. `firestore.indexes.json` est vide, le workflow ne déploie que `--only functions`, et la doc ne mentionne que `functions,firestore:rules`. Les auteurs connaissent la contrainte (commentaire `vaccineReminders.ts:74` qui évite précisément ce cas, `sleepTimer.ts:55-56`) mais pas pour ce chemin plus ancien. Si l'index n'a pas été créé à la main dans la console, `get()` rejette avec `FAILED_PRECONDITION` ; l'erreur n'est pas attrapée (ligne 80) et termine l'exécution de `checkMedicationReminders` pour tous les ménages/bébés.
- **Impact** : aucun rappel « Vitamin D » n'est jamais envoyé en prod ; et même si l'index a été créé en console, il n'est pas reproductible (nouveau projet, restauration) puisqu'il n'est pas dans le repo.
- **Solution proposée** : déclarer l'index dans `firestore.indexes.json` :
  ```json
  { "indexes": [{ "collectionGroup": "medicationEntries", "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "name", "order": "ASCENDING" }, { "fieldPath": "givenAt", "order": "ASCENDING" }] }], "fieldOverrides": [] }
  ```
  et déployer avec `firebase deploy --only functions,firestore:indexes` dans le workflow (ajouter `firestore.indexes.json` aux `paths`) et dans la doc. Alternative sans index : requêter seulement `givenAt >= startOfDay` (borne basse unique, peu de docs par jour) et filtrer `name` en mémoire. Dans tous les cas, entourer le corps par ménage d'un `try/catch` + `logger.error` pour qu'un échec n'annule pas les autres rappels (cf. FN-04). Test : test d'intégration émulateur (ou vérifier via `firebase emulators:exec` que la requête ne lève pas « requires an index »).
- **Complexité du fix** : S
- **Confiance** : Moyenne (règle Firestore certaine ; impossible de vérifier si l'index existe en console — mais son absence du repo est un problème en soi)

### [FN-02] Rappel médicament affiché deux fois : le SDK FCM affiche la notification `notification{}` ET `onBackgroundMessage` la réaffiche
- **Sévérité** : Haute
- **Catégorie** : bug
- **Fichier(s)** : `functions/src/index.ts:50-56`, `src/sw.ts:76-78`, `src/lib/foregroundPush.ts:17-29`
- **Constat** : `sendMedicationReminder` envoie un payload avec la clé `notification` (contrairement aux autres pushes, « data-only » via `push.ts`). Dans `@firebase/messaging/dist/esm/index.sw.esm.js:1393-1427` (`onPush`), en arrière-plan le SDK fait `if (internalPayload.notification) await showNotification(...)` **puis** appelle `onBackgroundMessageHandler(payload)`. Le handler de `sw.ts:76-78` affiche alors une seconde notification (sans `tag`, donc non fusionnée avec celle du SDK). En avant-plan, le SDK n'affiche rien et transmet à `onMessage` ; `showVaccinePushesInForeground` ignore ce payload (il ne traite que les types vaccin) : le rappel est silencieusement perdu quand l'app est ouverte.
- **Impact** : à 09:00 chaque jour, deux notifications « Reminder: Vitamin D » apparaissent sur chaque téléphone ; avec l'app ouverte, aucune.
- **Solution proposée** : aligner le rappel médicament sur les autres pushes : dans `index.ts`, remplacer `sendEachForMulticast({notification})` par `sendToHousehold(householdRef, { type: 'medication-reminder', medicationName }, 6*60*60)` (ce qui apporte aussi le nettoyage des tokens invalides et un TTL, cf. FN-07). Dans `src/lib/`, ajouter une constante `MEDICATION_REMINDER_PUSH = 'medication-reminder'` et une fonction `medicationNotification(name)` (`title`, `body`, `tag: 'medication-reminder-${name}'`, `data: { url: '/' }`), utilisée par `sw.ts` (dans `onBackgroundMessage`, à la place du fallback 76-78 qui doit disparaître) et par `foregroundPush.ts` (afficher aussi en avant-plan). Tests : `vaccineNotification.test.ts`-like pour la nouvelle fonction ; test SW (cf. FN-13) vérifiant qu'un payload `notification` n'appelle pas `showNotification` deux fois.
- **Complexité du fix** : M
- **Confiance** : Haute (code SDK lu)

### [FN-03] Rappel médicament non idempotent et sans rattrapage : double envoi (DST, retry) ou rappel perdu (tick raté, fenêtre 23:46–23:59)
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `functions/src/index.ts:19-24, 59-92`
- **Constat** : l'envoi dépend uniquement de « maintenant est dans `[timeOfDay, timeOfDay+15)` Paris ». Vérifié par script : le jour du passage à l'heure d'hiver (2026-10-25) la fenêtre 02:30 existe deux fois (00:30Z et 01:30Z) → deux envois ; au passage à l'heure d'été, un rappel entre 02:00 et 02:59 n'est jamais envoyé. La fenêtre ne gère pas le passage de minuit : un rappel à 23:50 (target 1430, fenêtre jusqu'à 1445) n'est atteint par aucun tick aligné (23:45 → 1425 < 1430 ; 00:00 → 0). Un tick qui échoue (FN-01, FN-04), un redéploiement au mauvais moment ou un retard > 15 min de Cloud Scheduler perd le rappel du jour ; une ré-exécution (retry, « Trigger now ») le renvoie. Aucun marqueur « déjà envoyé aujourd'hui » n'est stocké.
- **Impact** : rappel raté ou doublé dans ces cas, sans trace côté utilisateur.
- **Solution proposée** : rendre la condition « heure atteinte et pas encore envoyé aujourd'hui » : dans le doc reminder, stocker `lastSentOn: 'YYYY-MM-DD'` (Paris, via une `parisDateValue` déplacée dans `parisTime.ts`). Condition : `current >= target && reminder.lastSentOn !== today && !(await hasMedicationToday(...))` ; après envoi, `reminderDoc.ref.update({ lastSentOn: today })`. Cela rattrape un tick manqué (envoi au tick suivant), supprime le double envoi et règle minuit/DST (une seule date par jour). Supprimer `isWithinCheckWindow` ou la réduire à `current >= target`. Tests dans `index.test.ts` : extraire une fonction pure `shouldSendReminder(reminder, now, today)` et couvrir : déjà envoyé aujourd'hui → false ; heure dépassée + non envoyé → true ; 23:50 à 23:55 → true ; jour de DST.
- **Complexité du fix** : M
- **Confiance** : Haute

### [FN-04] Aucun `try/catch` par ménage/bébé dans les trois schedulers : une erreur sur un document annule tous les envois du tick
- **Sévérité** : Moyenne
- **Catégorie** : robustesse
- **Fichier(s)** : `functions/src/index.ts:67-90`, `functions/src/sleepTimer.ts:58-64`, `functions/src/vaccineReminders.ts:71-92`, `functions/src/push.ts:22-33`
- **Constat** : les boucles `for … of` enchaînent des `await` sans capture ; une requête qui rejette (index manquant, timeout Firestore, `sendEachForMulticast` qui rejette en bloc sur erreur réseau, `tokens[index].ref.delete()` qui échoue) remonte jusqu'au runtime et met fin à l'exécution. `onSchedule` n'a pas de `retryCount` configuré (défaut 0), les `onDocumentWritten` non plus : l'événement est perdu. `sendToHousehold` lance aussi les suppressions de tokens dans un `Promise.all` sans catch : un `delete` qui échoue fait échouer l'envoi déjà réussi (et le trigger).
- **Impact** : un seul bébé/ménage en erreur prive tous les autres de rappel ; un push de stop du timer perdu laisse une notification « Sleep Timer » périmée (FN-05).
- **Solution proposée** : factoriser un helper `forEachBaby(db, (household, baby) => Promise<void>)` dans un module commun (il est dupliqué 3 fois), avec `try { await fn(...) } catch (e) { logger.error('…', { householdId, babyId, error: e }) }` par itération. Dans `push.ts`, remplacer `Promise.all` par `Promise.allSettled` et logger les échecs de suppression. Activer `retryCount: 2` (ou `retry: true` sur les triggers Firestore) pour les opérations idempotentes (stop du timer, close vaccin), sans retry pour les envois non idempotents tant que FN-03 n'est pas fait. Test : avec un faux `db`, vérifier qu'un bébé dont la requête rejette n'empêche pas l'envoi pour le suivant.
- **Complexité du fix** : M
- **Confiance** : Haute

### [FN-05] Push de stop du timer avec TTL 60 s : un téléphone hors ligne garde une notification « Sleep Timer » collante et fausse indéfiniment
- **Sévérité** : Moyenne
- **Catégorie** : bug
- **Fichier(s)** : `functions/src/sleepTimer.ts:12, 79-81`, `src/lib/sleepTimerNotification.ts:26-28`, `src/hooks/useSleepTimerNotification.ts:34-38`
- **Constat** : la notification du timer est `requireInteraction: true`, remplacée en place chaque minute. L'arrêt est signalé par un push `sleep-timer-stop` envoyé avec `TICK_TTL_SECONDS = 60`. Si le téléphone de l'autre parent est hors réseau (ou en Doze) plus d'une minute à ce moment, FCM jette le push ; aucun tick ne suit (le sommeil est terminé) et aucun autre mécanisme ne ferme la notification tant que l'app n'est pas ouverte sur ce téléphone avec le bon bébé sélectionné (`useSleepTimerNotification` ferme après 3 s seulement pour `selectedBaby`). Le commentaire « A tick is worthless once the next one is due » est vrai pour les ticks, pas pour le stop.
- **Impact** : notification « Léo — 1h 05m » figée pendant des heures/jours sur un téléphone, jusqu'à ce que l'utilisateur la balaie ou ouvre l'app ; perte de confiance dans l'info affichée.
- **Solution proposée** : dans `sleepTimer.ts`, envoyer le stop avec un TTL long (`STOP_TTL_SECONDS = 24 * 60 * 60`) : fermer tard est inoffensif (si un nouveau sommeil a démarré entre-temps, le tick suivant réaffiche en ≤ 1 min). Optionnel côté SW : dans `sw.ts`, à la réception d'un stop, ne fermer que si `notification.data.startedAt` n'est pas postérieur à un `data.stoppedAt` ajouté au payload (évite de fermer le timer d'un nouveau sommeil). Côté client, dans `useSleepTimerNotification`, fermer aussi quand `uid` change/devient null. Test : `sleepTimer.test.ts` n'exerce que `sleepChange` ; ajouter un test de `onSleepEntryWritten` (handler extrait) vérifiant les headers `TTL` passés à `sendToHousehold` pour un stop.
- **Complexité du fix** : S
- **Confiance** : Haute

### [FN-06] Token FCM jamais supprimé à la déconnexion ; `createdAt` écrasé à chaque session, pas de purge des tokens périmés
- **Sévérité** : Moyenne
- **Catégorie** : sécurité
- **Fichier(s)** : `src/contexts/AuthContext.tsx:108-110`, `src/repositories/fcmTokens.ts:4-9`, `src/lib/pushRegistration.ts:12-19`, `functions/src/tokens.ts:9-19`
- **Constat** : `logout` fait seulement `signOut(auth)`. Le document `users/{uid}/fcmTokens/{token}` et l'abonnement push du navigateur restent : l'appareil continue à recevoir timers, rappels vaccin (avec prénom du bébé, dates de visite) et rappels médicament après déconnexion. Le token n'est jamais invalidé côté FCM (`deleteToken` n'est pas appelé), donc `push.ts` ne le nettoiera pas. Par ailleurs `saveFcmToken` réécrit `createdAt: Timestamp.now()` à chaque `registerPush` (le champ signifie en réalité « dernière vue ») et rien ne purge les tokens d'appareils abandonnés mais encore valides (FCM recommande d'écarter les tokens non vus depuis ~2 mois : ils ne renvoient pas d'erreur mais gonflent chaque envoi).
- **Impact** : compte Google partagé → un parent qui se connecte sur le téléphone d'un tiers (grand-parent, baby-sitter) puis se déconnecte laisse ce téléphone abonné aux notifications du foyer. Accumulation lente de tokens morts dans `collectHouseholdTokens` (1 lecture + 1 envoi par token, chaque minute pendant un sommeil).
- **Solution proposée** : ajouter `deleteFcmToken(uid, token)` dans `fcmTokens.ts` (`deleteDoc`) et `unregisterPush()` dans `pushRegistration.ts` : mémoriser le `token` courant à côté de `registeredUid`, puis à la déconnexion `await deleteFcmToken(uid, token)` **avant** `signOut` (les règles exigent `request.auth.uid == uid`), puis `deleteToken(getMessaging(app))` (firebase/messaging) dans un `try/catch`, et remettre `registeredUid = null`. Appeler `unregisterPush()` dans `AuthContext.logout`. Renommer `createdAt` en `lastSeenAt` (garder `createdAt` à la première écriture via `setDoc(..., { merge: true })`) et, dans `collectHouseholdTokens`, ignorer/supprimer les tokens dont `lastSeenAt` > 60 jours. Tests : `pushRegistration.test.ts` (unregister appelle delete + reset), `fcmTokens.test.ts`, test de `collectHouseholdTokens` avec un token périmé.
- **Complexité du fix** : M
- **Confiance** : Haute

### [FN-07] Chemin d'envoi du rappel médicament dupliqué : pas de nettoyage des tokens invalides, pas de TTL ni d'urgence
- **Sévérité** : Moyenne
- **Catégorie** : maintenabilité
- **Fichier(s)** : `functions/src/index.ts:43-57`, `functions/src/push.ts:14-34`
- **Constat** : `sendMedicationReminder` réimplémente l'envoi au lieu d'utiliser `sendToHousehold` : la réponse de `sendEachForMulticast` est ignorée (aucune suppression des tokens `registration-token-not-registered`, contrairement à `push.ts:28-33`) et aucun header `TTL` n'est posé (défaut Web Push : 4 semaines). Un token mort n'est donc nettoyé que si un push timer/vaccin le rencontre.
- **Impact** : un téléphone éteint 3 jours reçoit à son réveil « Vitamin D hasn't been given yet today » pour un jour passé ; les tokens morts persistent.
- **Solution proposée** : couverte par FN-02 (passer par `sendToHousehold` avec `ttlSeconds = 6*60*60`). Si le payload `notification` devait être conservé, au minimum faire passer la réponse par la même boucle de nettoyage et ajouter `webpush: { headers: { TTL: '21600' } }`. Test : test unitaire de `sendToHousehold` avec un `getMessaging` mocké renvoyant une erreur `messaging/registration-token-not-registered` → `ref.delete()` appelé (ce test n'existe pas non plus pour `push.ts`, cf. FN-13).
- **Complexité du fix** : S
- **Confiance** : Haute

### [FN-08] Tick du timer : 1440 parcours complets `households → babies → sleepEntries` par jour même sans sommeil en cours, relecture du bébé par entrée, et 4 jobs Cloud Scheduler (3 gratuits)
- **Sévérité** : Basse
- **Catégorie** : perf
- **Fichier(s)** : `functions/src/sleepTimer.ts:52-66, 37-49`, `functions/src/index.ts:65-74`, `functions/src/vaccineReminders.ts:70-79`, `docs/notifications-setup.md:11-12`
- **Constat** : chaque minute, `tickSleepTimerNotifications` lit la collection `households`, puis `babies`, puis une requête `sleepEntries` par bébé : ≈ (1 + 2·N bébés) lectures/min, soit ~7 200 lectures/jour pour 2 bébés sans aucun sommeil en cours (≈ 15 % du quota gratuit journalier, pour rien la plupart du temps). Pendant un sommeil, `sendRunningTimer` relit `babyRef.get()` pour le prénom alors que `baby.data().name` est déjà disponible dans la boucle, puis `collectHouseholdTokens` relit le ménage. Le commentaire (55-56) écarte `collectionGroup` parce que l'index « serait déployé à la main » : il peut en fait être versionné dans `firestore.indexes.json` (`fieldOverrides` avec `queryScope: COLLECTION_GROUP` sur `sleepEntries.endedAt`). Enfin, le projet déclare 4 jobs planifiés ; Cloud Scheduler en offre 3 gratuits par compte de facturation (~0,10 $/mois pour le 4e), ce que la doc « ≈ €0/mois » ne mentionne pas.
- **Impact** : coût/lectures inutiles ; le même parcours est copié-collé dans 3 fichiers.
- **Solution proposée** : (1) `collectionGroup('sleepEntries').where('endedAt', '==', null).get()` avec dans `firestore.indexes.json` : `"fieldOverrides": [{ "collectionGroup": "sleepEntries", "fieldPath": "endedAt", "indexes": [{ "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }] }]` → 1 lecture/min à vide ; remonter `babyRef = entry.ref.parent.parent`. (2) Passer `babyName` à `sendRunningTimer(entry, babyName)` depuis la boucle ; faire renvoyer par `collectHouseholdTokens` un résultat mémoïsé par ménage le temps d'un tick. (3) Mettre la doc à jour (jobs Scheduler, index). Les mêmes `fieldOverrides` permettraient un `collectionGroup('reminders').where('active','==',true)` pour FN-01. Test : vérifier le fichier d'index via `firebase emulators:exec`.
- **Complexité du fix** : M
- **Confiance** : Haute

### [FN-09] Un seul `tag: 'sleep-timer'` par appareil : avec deux bébés (ou deux sommeils) en cours, la notification alterne chaque minute
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `src/lib/sleepTimerNotification.ts:4, 26`, `functions/src/sleepTimer.ts:58-64, 79-81`, `src/hooks/useSleepTimerNotification.ts:34-38`
- **Constat** : le serveur envoie un push par entrée `endedAt == null` de **chaque** bébé du ménage ; le SW les affiche toutes sous le même `tag`, donc la dernière arrivée remplace l'autre (« Léo — 0h 12m » puis « Maëlys — 1h 40m », en alternance). Le stop d'un seul sommeil (`sleepChange === 'stopped'`) envoie `sleep-timer-stop` qui ferme la notification alors que l'autre bébé dort encore (réaffichée au tick suivant → clignotement). Côté app, `useSleepTimerNotification` ne suit que `selectedBaby` : changer de bébé sélectionné vers un bébé qui ne dort pas ferme (après 3 s) la notification du bébé qui dort, puis le serveur la réaffiche. Le cas « deux appareils démarrent le même sommeil » (reconnu dans `subscribeToActiveSleeps`/`ActiveTimersBanner`) produit aussi deux pushes/minute pour la même chose.
- **Impact** : foyers à deux enfants (la BabySelector existe) : notification instable ; coût d'envoi doublé pour un sommeil dupliqué.
- **Solution proposée** : rendre le tag par bébé : `sleepTimerTag(babyId) = 'sleep-timer-' + babyId`, ajouter `babyId` au payload (`sendRunningTimer` et stop : `{ type: 'sleep-timer-stop', babyId }`), fermer avec `getNotifications({ tag: sleepTimerTag(babyId) })` dans le SW et dans `closeSleepTimerNotification(babyId)` ; `SLEEP_TIMER_URL` devient `/?timer=sleep&baby=<id>` et `ActivityPage` sélectionne ce bébé. Dans le tick, dédupliquer par bébé (`running.docs[0]` après tri par `startedAt`, un seul push par bébé) et n'envoyer le stop que si plus aucune entrée du bébé ne tourne (requête `endedAt == null` dans `onSleepEntryWritten` avant d'envoyer). Dans `useSleepTimerNotification`, ne fermer que le tag du bébé dont `startedAt` passe à null (garder l'ancien `babyId` dans un `useRef`). Tests : `sleepTimerNotification.test.ts` (tag par bébé), test du handler SW.
- **Complexité du fix** : M
- **Confiance** : Haute

### [FN-10] `ReminderSettingsModal` : échec de `saveFcmToken` non géré → bouton bloqué sur « requesting » ; état initial ignore une permission déjà accordée
- **Sévérité** : Basse
- **Catégorie** : robustesse
- **Fichier(s)** : `src/components/ReminderSettingsModal.tsx:47-56, 74-86`
- **Constat** : `handleEnableNotifications` n'a pas de `try/catch` : si `saveFcmToken` rejette (hors ligne, règle refusée), la promesse est `void`ée, `notificationStatus` reste `'requesting'`, le bouton reste désactivé sans message. `requestNotificationToken` lui-même peut lever (`navigator.serviceWorker.ready` indisponible en navigation privée/iframe) : seul `getToken` est protégé (`messaging.ts:17-21`). À l'ouverture, le statut est `'idle'` même si `Notification.permission === 'granted'` et le token déjà enregistré : le bouton dit « Enable notifications » et rien n'indique que c'est fait ; en cas de permission `denied`, cliquer ne peut que renvoyer l'erreur.
- **Impact** : UX trompeuse ; blocage silencieux en cas d'erreur réseau.
- **Solution proposée** : `try { … } catch { setNotificationStatus('denied') }` autour de tout le handler (et renommer l'état `'denied'` en `'failed'` avec un message « Could not enable notifications. »). Initialiser l'état avec `Notification.permission` (`'denied'` → bouton désactivé + explication « blocked in browser settings » ; `'granted'` → appeler `registerPush(user.uid)` au montage et afficher « Notifications enabled »). Réutiliser `registerPush` plutôt que `requestNotificationToken` + `saveFcmToken` pour partager `registeredUid`. Test à ajouter dans `ReminderSettingsModal.test.tsx` : `saveFcmToken.mockRejectedValue` → alerte visible et bouton réactivé.
- **Complexité du fix** : S
- **Confiance** : Haute

### [FN-11] `hasMedicationToday` compare le nom exactement alors que l'app considère « vitamine » tout nom commençant par « vitamin »
- **Sévérité** : Basse
- **Catégorie** : bug
- **Fichier(s)** : `functions/src/index.ts:33-35`, `src/pages/ActivityPage.tsx:70-73`, `src/components/MedicationForm.tsx:14-23`
- **Constat** : le rappel est stocké sous `medicationName = 'Vitamin D'` (constante d'`ActivityPage`), et le serveur cherche `name == 'Vitamin D'`. Or `MedicationForm` laisse éditer le nom (une dose saisie « vitamin d » ou « Vitamine D ») et l'import Nara crée des entrées « Vitamin/Probiotic » ; `ActivityPage.isVitamin` les compte toutes comme la vitamine du jour (« last vitamin 2h ago »), mais le serveur non.
- **Impact** : l'app affiche la vitamine comme donnée, le téléphone sonne quand même à 09:00 « hasn't been given yet today ».
- **Solution proposée** : côté serveur, requêter `givenAt >= startOfDay` seulement (évite aussi l'index de FN-01) et filtrer en mémoire avec la même règle que le client, partagée : `name.trim().toLowerCase().startsWith(reminder.medicationName.trim().toLowerCase().split(' ')[0])` ou, plus propre, stocker sur le reminder un `matchPrefix: 'vitamin'` écrit par `setReminder`. Test : `index.test.ts` avec un faux snapshot contenant « Vitamin/Probiotic ».
- **Complexité du fix** : S
- **Confiance** : Haute

### [FN-12] Config Firebase codée en dur dans `sw.ts` (dupliquée avec `firebase.ts` qui lit `import.meta.env`) et SW exclu du typecheck
- **Sévérité** : Basse
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/sw.ts:34-41`, `src/lib/firebase.ts:10-17`, `tsconfig.app.json:26`
- **Constat** : la page initialise Firebase depuis `VITE_FIREBASE_*`, le SW depuis des littéraux (`messagingSenderId`, `appId`, …). vite-plugin-pwa compile `sw.ts` avec Vite et remplace `import.meta.env.VITE_*` : la duplication n'est pas nécessaire. Si les env diffèrent (émulateur, second projet, rotation d'`appId`), la page demande un token pour un `senderId` et le SW en écoute un autre : aucune notification, sans erreur. Par ailleurs `sw.ts` est exclu du `tsc -b` (commentaire 3-6) et n'a aucun test : une divergence de clés `data` avec le serveur ou un `await` manquant passent inaperçus.
- **Impact** : panne silencieuse des pushes en cas de changement de config ; régressions SW non détectées.
- **Solution proposée** : dans `sw.ts`, `initializeApp({ apiKey: import.meta.env.VITE_FIREBASE_API_KEY, … })` (mêmes clés que `firebase.ts`, idéalement un module `src/lib/firebaseConfig.ts` importé des deux côtés). Ajouter `tsconfig.sw.json` (`"lib": ["ES2022","WebWorker"]`, `"include": ["src/sw.ts"]`) référencé dans `tsconfig.json` pour que `tsc -b` le vérifie. Test : voir FN-13.
- **Complexité du fix** : S
- **Confiance** : Haute (Moyenne sur le remplacement `import.meta.env` dans le SW : dépend de la version de vite-plugin-pwa, à vérifier en build)

### [FN-13] Couverture de tests : toute la logique d'envoi (Firestore + FCM), le SW et les hooks de notification ne sont pas testés ; les tests existants ne couvrent que des helpers purs
- **Sévérité** : Basse
- **Catégorie** : tests
- **Fichier(s)** : `functions/src/index.test.ts`, `functions/src/sleepTimer.test.ts`, `functions/src/vaccineReminders.test.ts`, `functions/src/push.ts`, `functions/src/tokens.ts`, `src/sw.ts`, `src/lib/foregroundPush.ts`, `src/hooks/useSleepTimerNotification.ts`
- **Constat** : côté functions, seuls `isWithinCheckWindow`, `startOfParisDay`, `sleepChange`, `needsPurchaseQuestion`, `needsDayReminder`, `addDays`, `parisDateValue`, `purchaseQuestionSettled` sont testés. Rien n'exerce `sendToHousehold` (suppression des tokens sur `registration-token-not-registered`, index `tokens[index]` aligné sur `responses`), `collectHouseholdTokens` (`memberUids` absent), `hasMedicationToday`, `sendRunningTimer` (`parent.parent` deux niveaux), ni les boucles des schedulers. Les tests Paris n'incluent pas les jours de DST (29/03, 25/10). Côté client, `sw.ts`, `foregroundPush.ts` et `useSleepTimerNotification.ts` (délai de fermeture 3 s, gating de `registerPush` sur la permission) n'ont pas de test ; `pushRegistration.test.ts` ne couvre pas « permission `default` → `requestNotificationToken` appelé » ni « `saveFcmToken` rejette → nouvelle tentative possible ».
- **Impact** : FN-01, FN-02, FN-05, FN-09 auraient été détectables par des tests ; chaque refactor des functions est déployé en prod « à l'aveugle » (CI = ces tests uniquement).
- **Solution proposée** : (1) Dans functions, injecter les dépendances : `export async function runMedicationCheck(db: Firestore, now: Date, send: typeof sendToHousehold)` appelé par `onSchedule`, idem `runSleepTick`, `runVaccineReminders` ; tester avec des faux `db` minimalistes (objets `collection().get()` mockés) ou `@firebase/rules-unit-testing`/émulateur en CI (`firebase emulators:exec --only firestore 'vitest run'`). Test `push.test.ts` : `vi.mock('firebase-admin/messaging')` renvoyant `responses: [{success:true},{error:{code:'messaging/registration-token-not-registered'}}]` → seul `tokens[1].ref.delete` appelé. (2) `parisTime.test.ts` : `startOfParisDay` sur 2026-03-29 et 2026-10-25 (attendus `2026-03-28T23:00Z`, `2026-10-24T22:00Z`), `isWithinCheckWindow('02:30', …)` aux deux occurrences de l'heure d'hiver. (3) Client : extraire le corps de `onBackgroundMessage` en `handleBackgroundPush(registration, data)` dans `src/lib/backgroundPush.ts` testable sous jsdom (un payload par type → `showNotification`/`close` attendus), idem `handleNotificationClick`. Test de `useSleepTimerNotification` avec `vi.useFakeTimers()` : fermeture après 3 s, pas de `registerPush` quand `permission !== 'granted'`.
- **Complexité du fix** : L
- **Confiance** : Haute

### [FN-14] Redondance et nommage trompeur : `requestSleepTimerNotificationPermission().then(() => registerPush(uid))` copié 3 fois, y compris pour les vaccins, alors que `registerPush` demande déjà la permission
- **Sévérité** : Nit
- **Catégorie** : maintenabilité
- **Fichier(s)** : `src/components/SleepTimerModal.tsx:63-65`, `src/components/NewVisitModal.tsx:38-40`, `src/pages/PediatricianVisitPage.tsx:37-39`, `src/lib/sleepTimerNotification.ts:38-46`, `src/lib/pushRegistration.ts:12-19`
- **Constat** : `registerPush` → `requestNotificationToken` → `Notification.requestPermission()` si non accordée : l'appel préalable à `requestSleepTimerNotificationPermission` est redondant (il ne sert qu'à avaler l'exception du vieux Safari, que `messaging.ts:7` ne protège pas). La fonction nommée « sleep timer » est importée dans deux écrans vaccin. `docs/notifications-setup.md` ne décrit toujours que le rappel médicament (titre, §3) et pas le timer de sommeil.
- **Impact** : lecture trompeuse, triple duplication d'un enchaînement de promesses.
- **Solution proposée** : déplacer la protection try/catch de `requestPermission` dans `messaging.ts` (`requestNotificationToken`), supprimer `requestSleepTimerNotificationPermission`, et remplacer les 3 enchaînements par `void registerPush(user.uid).catch(() => {})` (renommer éventuellement en `enablePushForThisDevice`). Mettre à jour la doc (timer de sommeil, index, 4 jobs Scheduler). Tests : adapter `pushRegistration.test.ts` (permission `default` → `requestPermission` appelé une fois).
- **Complexité du fix** : S
- **Confiance** : Haute

---

## Points positifs / RAS
- Séparation propre « push data-only + rendu dans le SW/app » pour timer et vaccins : les clés `data` (`type`, `babyName`, `startedAt`, `babyId`, `visitId`, `visitDate`) et les tags correspondent exactement entre `functions/src/*.ts`, `sw.ts`, `foregroundPush.ts` et les helpers partagés ; `data.url`/`boughtUrl` → `notificationclick` → `Layout` (`navigate`) → `ActivityPage` (`?timer=sleep`) / `PediatricianVisitPage` (`vaccineBought`) est cohérent de bout en bout.
- `parisTime.ts` est correct (vérifié par script sur les jours de DST 2026) ; `sendToHousehold` nettoie les tokens `not-registered`/`invalid` ; les règles Firestore limitent bien `users/{uid}/fcmTokens` au propriétaire ; les listeners (`onMessage`, `serviceWorker.message`, `onSnapshot`) sont tous désabonnés.
- La logique des rappels médicament tourne bien côté serveur (`checkMedicationReminders`) : `useReminder`/`ReminderSettingsModal` ne font que lire/écrire la config, donc le rappel fonctionne app fermée (sous réserve de FN-01/FN-02). Permission Notification demandée depuis un geste utilisateur (Start du timer, « Vaccine: yes », bouton « Enable notifications »), jamais au chargement.
- Pas de secret dans les payloads ni dans le repo (la config Firebase web est publique par nature) ; CI functions avec `npm ci` + tests avant déploiement, `concurrency` pour éviter deux déploiements parallèles.

## Zones non couvertes
- État réel de la console Firebase (index composite créé à la main ou non, plan Blaze, clé VAPID) : non vérifiable statiquement.
- Comportement exact de l'alignement de `every 15 minutes` (Cloud Scheduler) sur les quarts d'heure : non vérifiable ; le raisonnement de FN-03 tient dans les deux hypothèses.
- Remplacement d'`import.meta.env` dans le SW par vite-plugin-pwa (FN-12) : non testé en build.
