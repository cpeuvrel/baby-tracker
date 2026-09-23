# Format d'export/import (CSV)

Un export = un fichier CSV par bébé, téléchargé depuis Family → Import / export.
L'import relit ce même format (ou un export RGPD Nara, voir plus bas) et
recrée les entrées dans Firestore (nouveaux identifiants de document à chaque
import — pas de déduplication, un import répété d'un même fichier crée des
doublons).

## Choix CSV vs JSON

Le format était initialement JSON (un seul fichier imbriqué). Remplacé par
CSV à la demande utilisatrice — plus simple à ouvrir/vérifier dans un
tableur, et format naturel pour importer un export Nara (lui-même en CSV).

## Forme du fichier natif

Un seul CSV, une ligne par entrée, toutes catégories mélangées, colonne
`category` en discriminant (colonnes non pertinentes laissées vides) :

```
category,at,endAt,durationSeconds,subtype,volumeMl,foodType,weightG,heightMm,headCircumferenceMm,medicationName,dose,notes,createdBy,createdAt
feeding,2026-03-05T08:00:00.000Z,,,bottle,120,,,,,,,,uid1,2026-03-05T08:00:00.000Z
sleep,2026-03-05T20:00:00.000Z,2026-03-05T21:30:00.000Z,5400,,,,,,,,,,uid1,2026-03-05T20:00:00.000Z
diaper,2026-03-05T09:00:00.000Z,,,wet,,,,,,,,,uid1,2026-03-05T09:00:00.000Z
growth,2026-03-05T10:00:00.000Z,,,,,,6200,620,410,,,,uid1,2026-03-05T10:00:00.000Z
medication,2026-03-05T09:00:00.000Z,,,,,,,,,Vitamine D,2 gouttes,,uid1,2026-03-05T09:00:00.000Z
```

Mapping par catégorie :

| category   | at          | colonnes propres                                    |
|------------|-------------|------------------------------------------------------|
| feeding    | occurredAt  | `subtype` (bottle/solid), `volumeMl`, `foodType`      |
| sleep      | startedAt   | `endAt`, `durationSeconds`                            |
| diaper     | occurredAt  | `subtype` (wet/dirty/both/dry)                        |
| growth     | measuredAt  | `weightG`, `heightMm`, `headCircumferenceMm`           |
| medication | givenAt     | `medicationName`, `dose`                               |

- `notes`, `createdBy`, `createdAt` : communes à toutes les catégories.
- Dates en ISO 8601 (`toISOString()`), reconverties en `Timestamp` Firestore
  à l'import via `new Date(...)`.
- Champs numériques vides = `null` (pas `0`).
- Pas de colonne `id` : les identifiants Firestore sont toujours régénérés à
  l'import, celui d'origine n'a aucune utilité dans le fichier.
- Les rappels (`reminders`) ne sont pas inclus : ce sont des réglages, pas
  des données à sauvegarder/restaurer.
- L'import détecte le format par l'en-tête (comparaison exacte à la liste de
  colonnes ci-dessus) ; sinon il essaie le format Nara (voir plus bas) ; sinon
  il refuse le fichier.

## Import d'un export RGPD Nara

L'import reconnaît aussi, en plus du format natif, l'export RGPD que Nara
fournit sur demande (CSV, une ligne par entrée, colonne `Type` en
discriminant, colonnes préfixées `[Bottle Feed]`, `[Sleep]`, `[Diaper]`,
`[Growth]`, `[Solid Feed]`, `[Routine]`, `[Profile]`). Détecté par
`header[0] === 'Type'` et présence de la colonne `_familyKey`.

Correspondances :

- **Bottle Feed** → `feeding` (bottle). Volume = somme de
  `[Bottle Feed] Breast Milk Volume` + `[Bottle Feed] Formula Volume`
  (converties en mL), ou à défaut `[Bottle Feed] Volume` générique.
- **Solid Feed** → `feeding` (solid). `[Solid Feed] Food` → `foodType` ;
  `[Solid Feed] Meal` (LUNCH/DINNER/…) reporté dans `notes` si pas de note.
- **Sleep** → `sleep`, à partir des colonnes Epoch (ms UTC), plus fiables que
  les dates locales + fuseau.
- **Diaper** → `diaper`. `[Diaper] Type` mappé ainsi :
  `Dirty Wet`→`both`, `Dirty`→`dirty`, `Wet`→`wet`, `Dry`→`dry`.
  `[Diaper] Detail`/`Dirty Color`/`Dirty Texture` repliés dans `notes`.
- **Growth** → `growth`. Poids/taille/périmètre crânien convertis vers les
  unités internes (grammes, millimètres) quelle que soit l'unité Nara
  (KG/G/LB, CM/MM/IN).
- **Routine** = `Vitamin/Probiotic` → `medication` (name="Vitamin/Probiotic",
  dose vide). Toute autre routine (ex. `Bath`) est ignorée.
- **Profile** : ignoré (métadonnées bébé, pas une entrée).

`parseImportFile` retourne aussi `skipped`, le nombre de lignes ignorées
(routines non prises en charge, ligne Profile) — affiché à l'utilisatrice
dans le message de succès de l'import.

`createdBy`/`createdAt` n'existent pas tels quels dans l'export Nara
(uniquement des noms d'aidants, pas des UID) : l'import Nara utilise l'UID de
la personne qui importe pour `createdBy`, et réutilise la date de
l'évènement comme `createdAt`.

## Implémentation

- `src/lib/csv.ts` : `toCsv`/`parseCsv`, utilitaires CSV génériques (RFC4180 :
  guillemets, virgules et retours à la ligne dans les champs).
- `src/lib/babyExport.ts` : assemble/sérialise (format natif) et parse
  (natif + Nara, avec détection automatique) + importe.
- `src/repositories/*.ts` : `getAllXEntries` (lecture complète, un bébé) et
  `importXEntries` (écriture par lot, `src/lib/firestoreBatch.ts`, chunké à
  450 écritures pour rester sous la limite Firestore de 500 par batch).
- `src/components/ExportImportSection.tsx` : bouton d'export (téléchargement
  navigateur direct, pas de Cloud Function) et champ de fichier pour l'import,
  sur l'écran Family.
