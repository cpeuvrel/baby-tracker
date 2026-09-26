// Adds a Vercel preview host to Firebase Auth's authorized domains, so Google
// sign-in works on it (Firebase doesn't accept wildcards there). Only the most
// recent previews are kept; production and other domains are never touched.
//
// Run by .github/workflows/preview-auth-domain.yml.
// Env: PREVIEW_URL, PROJECT_ID, ACCESS_TOKEN.

const MAX_PREVIEW_DOMAINS = 10
// Vercel preview hosts of this project: baby-tracker-<hash or git-branch>-baby-tracker7.vercel.app.
// The production aliases (baby-tracker-baby-tracker7…, …-git-main-…) don't match.
const PREVIEW_HOST = /^baby-tracker-(?!git-main-)[a-z0-9-]+-baby-tracker7\.vercel\.app$/

export function nextAuthorizedDomains(current, host) {
  if (current.includes(host)) return null
  const previews = current.filter((domain) => PREVIEW_HOST.test(domain))
  const kept = previews.slice(-(MAX_PREVIEW_DOMAINS - 1))
  return [...current.filter((domain) => !previews.includes(domain) || kept.includes(domain)), host]
}

async function main() {
  const { PREVIEW_URL, PROJECT_ID, ACCESS_TOKEN } = process.env
  const host = new URL(PREVIEW_URL).hostname
  if (!PREVIEW_HOST.test(host)) throw new Error(`Not a preview host of this project: ${host}`)

  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`
  const headers = { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }

  const response = await fetch(configUrl, { headers })
  if (!response.ok) throw new Error(`Reading the Auth config failed: ${response.status} ${await response.text()}`)
  const { authorizedDomains = [] } = await response.json()

  const next = nextAuthorizedDomains(authorizedDomains, host)
  if (!next) {
    console.log(`${host} is already authorized`)
    return
  }

  const update = await fetch(`${configUrl}?updateMask=authorizedDomains`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ authorizedDomains: next }),
  })
  if (!update.ok) throw new Error(`Updating the Auth config failed: ${update.status} ${await update.text()}`)
  console.log(`Authorized ${host}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
