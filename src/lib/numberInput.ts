/**
 * An optional positive amount typed in a number field: null when left blank, 'invalid' when it
 * is not a number or not above 0 (a volume or a weight of 0 or less is a typo).
 */
export function parseOptionalPositive(text: string): number | null | 'invalid' {
  if (text.trim() === '') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return 'invalid'
  return value
}
