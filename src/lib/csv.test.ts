import { describe, expect, it } from 'vitest'
import { neutralizeFormula, parseCsv, stripFormulaGuard, toCsv } from './csv'

describe('toCsv', () => {
  it('joins fields with commas and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2')
  })

  it('quotes fields containing a comma, quote or newline', () => {
    expect(toCsv([['a,b', 'c"d', 'e\nf']])).toBe('"a,b","c""d","e\nf"')
  })

  it('leaves plain fields unquoted', () => {
    expect(toCsv([['plain', '']])).toBe('plain,')
  })
})

describe('parseCsv', () => {
  it('parses a simple grid', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles quoted fields with embedded commas and doubled quotes', () => {
    expect(parseCsv('"a,b","c""d"\n1,2')).toEqual([
      ['a,b', 'c"d'],
      ['1', '2'],
    ])
  })

  it('handles embedded newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('ignores a trailing blank line', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('round-trips through toCsv', () => {
    const rows = [
      ['category', 'notes'],
      ['feeding', 'un peu de tout, "vraiment"'],
    ]

    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('parseCsv edge cases', () => {
  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsv('﻿category,at\nbath,x')).toEqual([
      ['category', 'at'],
      ['bath', 'x'],
    ])
  })

  it('strips a BOM before a quoted first field', () => {
    expect(parseCsv('﻿"Type","Note"\n"Sleep",""')).toEqual([
      ['Type', 'Note'],
      ['Sleep', ''],
    ])
  })

  it('treats a lone CR as a line break', () => {
    expect(parseCsv('a,b\r1,2\r')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps a quote found in the middle of an unquoted field', () => {
    expect(parseCsv('5" screen,b\n1,2')).toEqual([
      ['5" screen', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps an empty last field', () => {
    expect(parseCsv('a,\n1,')).toEqual([
      ['a', ''],
      ['1', ''],
    ])
  })

  it('keeps a quoted empty field at the end of the file', () => {
    expect(parseCsv('a,""')).toEqual([['a', '']])
  })
})

describe('formula neutralisation', () => {
  it.each(['=1+1', '+10 mL', '-1 dose', '@SUM(A1)', '\tx', '\rx'])('prefixes %j with an apostrophe', (field) => {
    expect(neutralizeFormula(field)).toBe(`'${field}`)
  })

  it('leaves other fields alone', () => {
    expect(neutralizeFormula('plain')).toBe('plain')
    expect(neutralizeFormula("'quoted")).toBe("'quoted")
    expect(neutralizeFormula('2026-01-01T08:00:00.000Z')).toBe('2026-01-01T08:00:00.000Z')
  })

  it('neutralises a leading = in the CSV output', () => {
    expect(toCsv([['=HYPERLINK("x")', 'ok']])).toBe(`"'=HYPERLINK(""x"")",ok`)
  })

  it('round-trips through stripFormulaGuard, including text already starting with an apostrophe', () => {
    for (const field of ['=1+1', '-1 dose', "'=x", "''+y", "'plain", 'plain']) {
      expect(stripFormulaGuard(parseCsv(toCsv([[field]]))[0][0])).toBe(field)
    }
  })
})
