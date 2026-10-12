/** UTF-8 byte order mark: Excel adds it when saving as "CSV UTF-8", and needs it to read accents. */
export const BOM = '﻿'

// A cell starting with one of these is read as a formula by Excel / LibreOffice ("-1 dose",
// "=HYPERLINK(…)"). Such a field is exported behind an apostrophe (OWASP CSV injection advice).
// A field that already starts with apostrophes before such a character gets one more, so that
// removing exactly one on import gives the original text back.
const FORMULA_GUARDED = /^'*[=+\-@\t\r]/
const FORMULA_GUARD = /^'+[=+\-@\t\r]/

/** Prefixes the field with an apostrophe when a spreadsheet would run it as a formula. */
export function neutralizeFormula(field: string): string {
  return FORMULA_GUARDED.test(field) ? `'${field}` : field
}

/** Removes the apostrophe `neutralizeFormula` added (round trip of the app's own export). */
export function stripFormulaGuard(field: string): string {
  return FORMULA_GUARD.test(field) ? field.slice(1) : field
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n')
}

function escapeField(field: string): string {
  const safe = neutralizeFormula(field)
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * Parses RFC 4180 CSV, leniently: a leading UTF-8 BOM (Excel's "CSV UTF-8") is ignored, a lone
 * CR ends a line like LF and CRLF, and a quote inside an unquoted field is kept as text.
 */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith(BOM) ? input.slice(BOM.length) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let fieldQuoted = false
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
    fieldQuoted = false
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"' && field === '' && !fieldQuoted) {
      inQuotes = true
      fieldQuoted = true
      i += 1
      continue
    }
    if (char === ',') {
      endField()
      i += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      endRow()
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += char
    i += 1
  }

  if (field !== '' || fieldQuoted || row.length > 0) {
    endRow()
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}
