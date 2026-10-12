# Export/import format (CSV)

An export = one CSV file per baby, downloaded from Family → Import / export.
Import reads back this same format (or a Nara GDPR export, see below) and
writes the entries into the selected baby. Every row is validated before
anything is written, and entries the app already has are not imported twice
(see [Deduplication on import](#deduplication-on-import)): importing the same
file again adds nothing.

## CSV vs JSON choice

The format was initially JSON (a single nested file). Replaced by CSV at the
user's request — simpler to open/check in a spreadsheet app, and a natural
format for importing a Nara export (itself CSV).

## What the export contains — and what it does not

The export holds the **logged entries** of one baby: feedings, sleeps,
diapers, growth measurements, medications and baths.

Not exported (and not touched by an import):

- **Pediatrician visits** (`pediatricianVisits`: date, vaccine, remarks,
  questions/answers). The file is therefore not a complete backup of a baby;
  the screen says so next to the Export button.
- **Reminders** (`reminders`): settings, not data to back up/restore.
- **The sleep timer lock** (`locks/sleepTimer`): internal state of a running
  sleep.
- The baby itself (name, birth date, sex, photo, nighttime hours) and the
  household.

"Delete All Data" deletes the same six entry collections and nothing else:
pediatrician visits and reminders are kept (the button's description and its
confirmation say so). Deleting the child from the Family screen
(`deleteBabyWithData`) removes everything: entries, reminders, visits, the
lock, then the baby.

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
| bath       | occurredAt  | —                                                 |

- `notes`, `createdBy`, `createdAt`: common to all categories.
- Dates in ISO 8601 (`toISOString()`), converted back to a Firestore
  `Timestamp` on import via `new Date(...)`.
- Empty numeric fields = `null` (not `0`).
- No `id` column: Firestore ids are always regenerated on import, the
  original one is of no use in the file.
- A sleep still running at export time has an empty `endAt`.
- Import detects the format from the header (exact match against the column
  list above, after an optional BOM); if that fails it tries the Nara format
  (see below); if that also fails it rejects the file.

### Opening the file in a spreadsheet

- The downloaded file starts with a UTF-8 BOM, so Excel reads accents
  correctly. The import ignores a leading BOM, so a file re-saved by Excel
  ("CSV UTF-8") is accepted.
- A text cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return
  would be run as a formula by Excel/LibreOffice ("-1 dose", `=HYPERLINK(…)`):
  such a field is exported behind an apostrophe (`'-1 dose`). The native
  import removes that apostrophe, so export → import gives the text back
  unchanged (a field that really starts with apostrophes before such a
  character gets one more on export). See `neutralizeFormula` /
  `stripFormulaGuard` in `src/lib/csv.ts`.

### Validation of native rows

Every data row is checked before anything is written; the first problem
aborts the import with a message naming the row (`Line N: …`, the header
being line 1):

- exactly 15 columns (a spreadsheet that drops trailing empty columns breaks
  this);
- `at` (and `endAt` when filled, `createdAt` when filled) must be dates;
- numeric columns must be numbers or empty (never stored as `NaN`);
- `subtype` must be one of the values listed above for feeding/diaper;
- a medication needs a `medicationName`.

A row whose `category` is unknown is not an error: it is counted in
`skipped`, like the unsupported Nara rows. An empty `createdAt` falls back to
the entry's time, an empty `createdBy` to the importing user.

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
  the local date + timezone columns. No end epoch = a sleep still running.
- **Diaper** → `diaper`. `[Diaper] Type` mapped as follows:
  `Dirty Wet`→`both`, `Dirty`→`dirty`, `Wet`→`wet`, `Dry`→`dry`.
  `[Diaper] Detail`/`Dirty Color`/`Dirty Texture` folded into `notes`.
- **Growth** → `growth`. Weight/height/head circumference converted to the
  internal units (grams, millimeters) regardless of Nara's unit
  (KG/G/LB, CM/MM/IN).
- **Routine** = `Vitamin/Probiotic` → `medication` (name="Vitamin/Probiotic",
  empty dose); `Bath` → `bath`. Any other routine is ignored.
- **Profile**: ignored (baby metadata, not an entry).

A row without a readable `Start Date/time (Epoch)` is skipped (never dated
1970); an unreadable amount is read as empty (never `NaN`).

`createdBy`/`createdAt` don't exist as such in the Nara export (only
caregiver names, not UIDs): the Nara import reuses the event's date as
`createdAt`.

## Deduplication on import

`importBabyData` first reads every entry the baby already has, then drops
each incoming entry whose key matches an existing entry or an earlier row of
the same file:

- key = category + time **to the minute (UTC)** (`timeKey`: the app logs
  minutes, imported files may carry seconds): `occurredAt` for feeding,
  diaper and bath, `startedAt` for sleep, `measuredAt` for growth;
- medications add the name, trimmed and lower-cased
  (`name.trim().toLowerCase()`), since two medications can be given at the
  same minute.

Consequences: the entry already in the app always wins, whatever the values
in the file (an edited note in the file is *not* applied); and two entries of
the same category in the same minute are treated as one (only the first is
imported).

## Import result

`parseImportFile` returns the parsed entries and `skipped` (rows of an
unknown category, unsupported Nara routines, the Profile row, Nara rows
without a start time). `importBabyData` returns:

- `imported`: entries actually written;
- `duplicates`: entries ignored by the deduplication above;
- `skippedRunning`: sleeps still running in the file (no end), never
  written — a stale timer would be refused by the sleep lock anyway.

All are shown in the import success message. Every written entry gets the
importing user as `createdBy`, whatever the file says: `firestore.rules`
only accept entries created by the signed-in user (the file may have been
exported from another account).

## Implementation

- `src/lib/csv.ts`: `toCsv`/`parseCsv`, generic CSV utilities (RFC4180:
  quotes, commas and line breaks inside fields; lenient on a BOM, a lone CR
  and a quote inside an unquoted field), formula neutralisation.
- `src/lib/babyExport.ts`: assembles/serializes (native format) and parses
  (native + Nara, with automatic detection) + validates + deduplicates +
  imports; `deleteAllBabyData` / `deleteBabyWithData`.
- `src/repositories/*.ts`: `getAllXEntries` (full read, one baby) and
  `importXEntries` (batch write, `src/lib/firestoreBatch.ts`, chunked at
  450 writes to stay under Firestore's 500-per-batch limit).
- `src/components/ExportImportSection.tsx`: export button (direct browser
  download through a temporary Blob URL, no Cloud Function) and file field
  for import, on the Family screen.
