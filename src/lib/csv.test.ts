import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

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
