/**
 * Which user and FCM token this device is registered under, saved by the app
 * and read by the service worker (which has no signed-in user of its own).
 * Cache Storage: the one store both share without extra code.
 */
const CACHE_NAME = 'push-identity'
const CACHE_KEY = '/push-identity'

export interface PushIdentity {
  uid: string
  token: string
}

export async function savePushIdentity(identity: PushIdentity): Promise<void> {
  if (typeof caches === 'undefined') return
  const cache = await caches.open(CACHE_NAME)
  await cache.put(CACHE_KEY, new Response(JSON.stringify(identity)))
}

export async function readPushIdentity(): Promise<PushIdentity | null> {
  if (typeof caches === 'undefined') return null
  const cache = await caches.open(CACHE_NAME)
  const response = await cache.match(CACHE_KEY)
  if (!response) return null
  const identity = (await response.json()) as Partial<PushIdentity>
  return identity.uid && identity.token ? { uid: identity.uid, token: identity.token } : null
}
