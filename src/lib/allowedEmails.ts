/**
 * Google accounts allowed to use the app. firestore.rules holds the same list (isAllowedEmail):
 * allowedEmails.test.ts fails when the two differ.
 */
export const ALLOWED_EMAILS: readonly string[] = ['amandineandcorentin@gmail.com']

/** Case- and whitespace-insensitive: an address is the same account whatever its capitalisation. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}
