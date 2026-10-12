import type { DocumentReference } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendToHousehold } from './push'
import type { HouseholdToken } from './tokens'

const sendEachForMulticast = vi.fn()

vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast }) }))
vi.mock('firebase-functions', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const householdRef = { path: 'households/h1' } as DocumentReference

function token(id: string, remove = vi.fn().mockResolvedValue(undefined)) {
  return { token: id, ref: { delete: remove } as unknown as DocumentReference, remove }
}

const loader = (tokens: HouseholdToken[]) => async () => tokens

describe('sendToHousehold', () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset()
  })

  it('sends a data-only push with the TTL to every device', async () => {
    sendEachForMulticast.mockResolvedValue({ responses: [{ success: true }, { success: true }] })

    await sendToHousehold(householdRef, { type: 'x' }, 600, loader([token('t1'), token('t2')]))

    expect(sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['t1', 't2'],
      data: { type: 'x' },
      webpush: { headers: { Urgency: 'high', TTL: '600' } },
    })
  })

  it('sends nothing to a household without devices', async () => {
    await sendToHousehold(householdRef, { type: 'x' }, 600, loader([]))

    expect(sendEachForMulticast).not.toHaveBeenCalled()
  })

  it('deletes only the tokens FCM no longer knows', async () => {
    const tokens = [token('t1'), token('t2'), token('t3')]
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/internal-error' } },
      ],
    })

    await sendToHousehold(householdRef, { type: 'x' }, 600, loader(tokens))

    expect(tokens[0].remove).not.toHaveBeenCalled()
    expect(tokens[1].remove).toHaveBeenCalledTimes(1)
    expect(tokens[2].remove).not.toHaveBeenCalled()
  })

  it('does not fail the push when a clean-up fails, and still tries the others', async () => {
    const tokens = [token('t1', vi.fn().mockRejectedValue(new Error('offline'))), token('t2')]
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    })

    await expect(sendToHousehold(householdRef, { type: 'x' }, 600, loader(tokens))).resolves.toBeUndefined()

    expect(tokens[1].remove).toHaveBeenCalledTimes(1)
  })
})
