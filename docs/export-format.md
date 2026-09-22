# Format d'export/import (JSON)

Un export = un fichier JSON par bébé, téléchargé depuis Family → Import / export.
L'import relit ce même format et recrée les entrées dans Firestore (nouveaux
identifiants de document à chaque import — pas de déduplication, un import
répété d'un même fichier crée des doublons).

## Choix CSV vs JSON

Le plan initial envisageait CSV ou JSON. JSON a été retenu : un seul fichier
plutôt qu'un par sous-collection, types (nullable, nombres) non ambigus, et
structure imbriquée naturelle pour `{ baby, feedingEntries, sleepEntries, ... }`.

## Forme du fichier

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-03-05T10:00:00.000Z",
  "baby": { "name": "Léo", "birthDate": "2025-06-01" },
  "feedingEntries": [
    {
      "id": "…",
      "type": "bottle",
      "occurredAt": "2026-03-05T08:00:00.000Z",
      "volumeMl": 120,
      "foodType": null,
      "notes": "",
      "createdBy": "uid…",
      "createdAt": "2026-03-05T08:00:00.000Z"
    }
  ],
  "sleepEntries": [
    {
      "id": "…",
      "startedAt": "2026-03-05T20:00:00.000Z",
      "endedAt": "2026-03-05T21:30:00.000Z",
      "durationSeconds": 5400,
      "notes": "",
      "createdBy": "uid…",
      "createdAt": "2026-03-05T20:00:00.000Z"
    }
  ],
  "diaperEntries": [
    {
      "id": "…",
      "type": "pee",
      "occurredAt": "2026-03-05T09:00:00.000Z",
      "notes": "",
      "createdBy": "uid…",
      "createdAt": "2026-03-05T09:00:00.000Z"
    }
  ],
  "growthEntries": [
    {
      "id": "…",
      "measuredAt": "2026-03-05T10:00:00.000Z",
      "weightG": 6200,
      "heightMm": 620,
      "headCircumferenceMm": 410,
      "notes": "",
      "createdBy": "uid…",
      "createdAt": "2026-03-05T10:00:00.000Z"
    }
  ],
  "medicationEntries": [
    {
      "id": "…",
      "name": "Vitamine D",
      "givenAt": "2026-03-05T09:00:00.000Z",
      "dose": "2 gouttes",
      "notes": "",
      "createdBy": "uid…",
      "createdAt": "2026-03-05T09:00:00.000Z"
    }
  ]
}
```

- `formatVersion` : entier, `1` actuellement. L'import refuse tout fichier
  dont la valeur ne correspond pas exactement — pas de migration automatique
  entre versions pour l'instant (2 utilisateurs, changement de format rare et
  visible).
- Les champs `id` sont ignorés à l'import (nouveaux documents systématiquement
  créés) — présents dans l'export pour lisibilité/débogage seulement.
- Les rappels (`reminders`) ne sont pas inclus : ce sont des réglages, pas des
  données à sauvegarder/restaurer.
- Dates en ISO 8601 (`toISOString()`), reconverties en `Timestamp` Firestore à
  l'import via `new Date(...)`.

## Implémentation

- `src/lib/babyExport.ts` : assemble/sérialise/parse/importe.
- `src/repositories/*.ts` : `getAllXEntries` (lecture complète, un bébé) et
  `importXEntries` (écriture par lot, `src/lib/firestoreBatch.ts`, chunké à
  450 écritures pour rester sous la limite Firestore de 500 par batch).
- `src/components/ExportImportSection.tsx` : bouton d'export (téléchargement
  navigateur direct, pas de Cloud Function) et champ de fichier pour l'import,
  sur l'écran Family.

## Import d'un export RGPD Nara

Pas de conversion automatique tant que le format exact de l'export Nara n'est
pas connu (voir plan.md section 9) — prévoir un script ponctuel une fois le
fichier récupéré, plutôt que du code générique non testé.
