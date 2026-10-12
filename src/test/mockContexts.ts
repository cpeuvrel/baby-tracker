import type { User } from 'firebase/auth'
import { vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { ALLOWED_EMAILS } from '../lib/allowedEmails'
import type { Baby, Household } from '../types/models'

type AuthValue = ReturnType<typeof AuthContext.useAuth>
type HouseholdValue = ReturnType<typeof HouseholdContext.useHousehold>

export const defaultHousehold: Household = { id: 'h1', name: 'Famille Test', memberUids: [] }
export const defaultBaby: Baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

/**
 * Spies on `useAuth` and returns the mocked value: a signed-in, allowed and verified user by default,
 * every action a `vi.fn()`. Call it in a `beforeEach` or in the test itself (`restoreMocks` undoes the spy).
 */
export function mockAuth(overrides: Partial<AuthValue> = {}): AuthValue {
  const value: AuthValue = {
    user: { uid: 'uid1', email: ALLOWED_EMAILS[0], emailVerified: true } as User,
    loading: false,
    error: null,
    devLoginAvailable: false,
    loginWithGoogle: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue(value)
  return value
}

/**
 * Spies on `useHousehold` and returns the mocked value: `defaultHousehold` with `defaultBaby`
 * selected by default. Pass `babies` / `selectedBaby` / `household` overrides for other fixtures.
 */
export function mockHousehold(overrides: Partial<HouseholdValue> = {}): HouseholdValue {
  const value: HouseholdValue = {
    household: defaultHousehold,
    babies: [defaultBaby],
    loading: false,
    error: null,
    selectedBaby: defaultBaby,
    selectBaby: vi.fn(),
    ...overrides,
  }
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue(value)
  return value
}
