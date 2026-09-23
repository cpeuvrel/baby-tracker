# Activer les rappels médicament (FCM) en production

Le code du rappel (saisie, réglages, Cloud Function, service worker) est en
place et testable via l'émulateur. Deux actions manuelles restent à faire une
seule fois dans la console Firebase avant que les notifications marchent en
conditions réelles :

## 1. Passer au plan Blaze

Console Firebase → Paramètres du projet → Utilisation et facturation →
passer au forfait **Blaze** (carte bancaire requise). Coût réel attendu ≈ 0€/mois
à cet usage (2 utilisateurs). Penser à configurer une alerte de budget à 0€/1€.

Nécessaire car les fonctions programmées (`onSchedule`, Cloud Scheduler) ne
sont pas disponibles sur le plan gratuit "Spark".

## 2. Générer la clé VAPID (Web Push)

Console Firebase → Paramètres du projet → Cloud Messaging → onglet
"Web configuration" → **Generate key pair**. Copier la clé générée dans
`.env.local` :

```
VITE_FCM_VAPID_KEY=<clé générée>
```

## 3. Déployer

```
firebase deploy --only functions,firestore:rules
```

La Cloud Function `checkMedicationReminders` tourne toutes les 15 minutes et
envoie une notification si le médicament d'un rappel actif n'a pas été
enregistré le jour même.

## Tester en local sans Blaze

`firebase emulators:start --only firestore,auth,functions,pubsub` puis, dans
l'UI de l'émulateur (onglet Functions), bouton "Trigger now" sur
`checkMedicationReminders` pour déclencher une exécution manuelle.
