// @vitest-environment node
import { describe, expect, it } from 'vitest'
import rules from '../../firestore.rules?raw'
import { ALLOWED_EMAILS, isAllowedEmail } from './allowedEmails'

/** The addresses listed in `request.auth.token.email…in [...]` of firestore.rules. */
function rulesEmails(): string[] {
  const match = /request\.auth\.token\.email(?:\.lower\(\))?\s+in\s+\[([^\]]*)\]/.exec(rules)
  if (!match) throw new Error('No email allowlist found in firestore.rules')
  return [...match[1].matchAll(/'([^']+)'/g)].map((quoted) => quoted[1])
}

describe('ALLOWED_EMAILS', () => {
  it('matches the allowlist of firestore.rules exactly', () => {
    expect([...rulesEmails()].sort()).toEqual([...ALLOWED_EMAILS].sort())
  })

  it('is stored in lower case, as compared by the client and the rules', () => {
    for (const email of ALLOWED_EMAILS) expect(email).toBe(email.toLowerCase())
  })
})

describe('isAllowedEmail', () => {
  it('accepts an allowlisted address whatever its case and surrounding spaces', () => {
    expect(isAllowedEmail('amandineandcorentin@gmail.com')).toBe(true)
    expect(isAllowedEmail('Amandineandcorentin@Gmail.com')).toBe(true)
    expect(isAllowedEmail(' amandineandcorentin@gmail.com ')).toBe(true)
  })

  it('refuses other, empty or missing addresses', () => {
    expect(isAllowedEmail('someone@gmail.com')).toBe(false)
    expect(isAllowedEmail('amandineandcorentin@gmail.com.evil.com')).toBe(false)
    expect(isAllowedEmail('')).toBe(false)
    expect(isAllowedEmail(null)).toBe(false)
    expect(isAllowedEmail(undefined)).toBe(false)
  })
})
