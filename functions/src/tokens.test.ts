import { Timestamp } from 'firebase-admin/firestore'
import { describe, expect, it, vi } from 'vitest'
import { FakeDocRef, FakeFirestore } from './test/fakeFirestore'
import { collectHouseholdTokens, memoizeTokenLoader } from './tokens'

vi.mock('firebase-functions', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const now = new Date('2026-10-12T12:00:00Z')
const daysAgo = (days: number) => Timestamp.fromMillis(now.getTime() - days * 24 * 60 * 60 * 1000)

describe('collectHouseholdTokens', () => {
  it("gathers every member's devices and drops the ones not seen for 60 days", async () => {
    const db = new FakeFirestore({
      'households/h1': { memberUids: ['u1', 'u2'] },
      'users/u1/fcmTokens/fresh': { token: 'fresh', lastSeenAt: daysAgo(3), createdAt: daysAgo(400) },
      'users/u1/fcmTokens/stale': { token: 'stale', lastSeenAt: daysAgo(61) },
      // Saved before `lastSeenAt` existed.
      'users/u2/fcmTokens/legacy': { token: 'legacy', createdAt: daysAgo(10) },
      'users/u2/fcmTokens/legacy-stale': { token: 'legacy-stale', createdAt: daysAgo(90) },
      'users/u3/fcmTokens/other': { token: 'other', lastSeenAt: daysAgo(1) },
    })

    const tokens = await collectHouseholdTokens(new FakeDocRef(db, 'households/h1').asRef(), now)

    expect(tokens.map(({ token }) => token)).toEqual(['fresh', 'legacy'])
    expect(db.deleted.sort()).toEqual(['users/u1/fcmTokens/stale', 'users/u2/fcmTokens/legacy-stale'])
  })

  it('returns no token for a household without members', async () => {
    const db = new FakeFirestore({ 'households/h1': {} })

    expect(await collectHouseholdTokens(new FakeDocRef(db, 'households/h1').asRef(), now)).toEqual([])
  })
})

describe('memoizeTokenLoader', () => {
  it("reads each household's tokens once", async () => {
    const db = new FakeFirestore()
    const load = vi.fn().mockResolvedValue([])
    const loadOnce = memoizeTokenLoader(load)

    await loadOnce(new FakeDocRef(db, 'households/h1').asRef())
    await loadOnce(new FakeDocRef(db, 'households/h1').asRef())
    await loadOnce(new FakeDocRef(db, 'households/h2').asRef())

    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reads again after a failed read', async () => {
    const db = new FakeFirestore()
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([])
    const loadOnce = memoizeTokenLoader(load)
    const ref = new FakeDocRef(db, 'households/h1').asRef()

    await expect(loadOnce(ref)).rejects.toThrow('offline')
    await expect(loadOnce(ref)).resolves.toEqual([])
  })
})
