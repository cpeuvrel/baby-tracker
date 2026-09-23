# Export/import format (CSV)

An export = one CSV file per baby, downloaded from Family → Import / export.
Import reads back this same format (or a Nara GDPR export, see below) and
recreates the entries in Firestore (new document ids on every import — no
deduplication, importing the same file repeatedly creates duplicates).

## CSV vs JSON choice

The format was initially JSON (a single nested file). Replaced by CSV at the
user's request — simpler to open/check in a spreadsheet app, and a natural
format for importing a Nara export (itself CSV).

## Native file shape

A single CSV, one row per entry, all categories mixed together, `category`
column as a discriminator (irrelevant columns left blank):

```
category,at,endAt,durationSeconds,subtype,volumeMl,foodType,weightG,heightMm,headCircumferenceMm,medicationName,dose,notes,createdBy,createdAt
feeding,2026-03-05T08:00:00.000Z,,,bottle,120,,,,,,,,uid1,2026-03-05T08:00:00.000Z
sleep,2026-03-05T20:00:00.000Z,2026-03-05T21:30:00.000Z,5400,,,,,,,,,,uid1,2026-03-05T20:00:00.000Z
diaper,2026-03-05T09:00:00.000Z,,,wet,,,,,,,,,uid1,2026-03-05T09:00:00.000Z
growth,2026-03-05T10:00:00.000Z,,,,,,6200,620,410,,,,uid1,2026-03-05T10:00:00.000Z
medication,2026-03-05T09:00:00.000Z,,,,,,,,,Vitamin D,2 drops,,uid1,2026-03-05T09:00:00.000Z
```

Mapping by category:

| category   | at          | own columns                                    |
|------------|-------------|--------------------------------------------------|
| feeding    | occurredAt  | `subtype` (bottle/solid), `volumeMl`, `foodType`  |
| sleep      | startedAt   | `endAt`, `durationSeconds`                        |
| diaper     | occurredAt  | `subtype` (wet/dirty/both/dry)                    |
| growth     | measuredAt  | `weightG`, `heightMm`, `headCircumferenceMm`      |
| medication | givenAt     | `medicationName`, `dose`                          |

- `notes`, `createdBy`, `createdAt`: common to all categories.
- Dates in ISO 8601 (`toISOString()`), converted back to a Firestore
  `Timestamp` on import via `new Date(...)`.
- Empty numeric fields = `null` (not `0`).
- No `id` column: Firestore ids are always regenerated on import, the
  original one is of no use in the file.
- Reminders (`reminders`) are not included: they're settings, not data to
  back up/restore.
- Import detects the format from the header (exact match against the column
  list above); if that fails it tries the Nara format (see below); if that
  also fails it rejects the file.

## Importing a Nara GDPR export

In addition to the native format, import also recognizes the GDPR export
that Nara provides on request (CSV, one row per entry, `Type` column as a
discriminator, columns prefixed `[Bottle Feed]`, `[Sleep]`, `[Diaper]`,
`[Growth]`, `[Solid Feed]`, `[Routine]`, `[Profile]`). Detected via
`header[0] === 'Type'` and the presence of the `_familyKey` column.

Mappings:

- **Bottle Feed** → `feeding` (bottle). Volume = sum of
  `[Bottle Feed] Breast Milk Volume` + `[Bottle Feed] Formula Volume`
  (converted to mL), or otherwise the generic `[Bottle Feed] Volume`.
- **Solid Feed** → `feeding` (solid). `[Solid Feed] Food` → `foodType`;
  `[Solid Feed] Meal` (LUNCH/DINNER/…) carried over into `notes` if there's
  no existing note.
- **Sleep** → `sleep`, from the Epoch columns (ms UTC), more reliable than
  the local date + timezone columns.
- **Diaper** → `diaper`. `[Diaper] Type` mapped as follows:
  `Dirty Wet`→`both`, `Dirty`→`dirty`, `Wet`→`wet`, `Dry`→`dry`.
  `[Diaper] Detail`/`Dirty Color`/`Dirty Texture` folded into `notes`.
- **Growth** → `growth`. Weight/height/head circumference converted to the
  internal units (grams, millimeters) regardless of Nara's unit
  (KG/G/LB, CM/MM/IN).
- **Routine** = `Vitamin/Probiotic` → `medication` (name="Vitamin/Probiotic",
  empty dose). Any other routine (e.g. `Bath`) is ignored.
- **Profile**: ignored (baby metadata, not an entry).

`parseImportFile` also returns `skipped`, the number of skipped rows
(unsupported routines, Profile row) — shown to the user in the import
success message.

`createdBy`/`createdAt` don't exist as such in the Nara export (only
caregiver names, not UIDs): the Nara import uses the importing person's UID
for `createdBy`, and reuses the event's date as `createdAt`.

## Implementation

- `src/lib/csv.ts`: `toCsv`/`parseCsv`, generic CSV utilities (RFC4180:
  quotes, commas and line breaks inside fields).
- `src/lib/babyExport.ts`: assembles/serializes (native format) and parses
  (native + Nara, with automatic detection) + imports.
- `src/repositories/*.ts`: `getAllXEntries` (full read, one baby) and
  `importXEntries` (batch write, `src/lib/firestoreBatch.ts`, chunked at
  450 writes to stay under Firestore's 500-per-batch limit).
- `src/components/ExportImportSection.tsx`: export button (direct browser
  download, no Cloud Function) and file field for import, on the Family
  screen.
