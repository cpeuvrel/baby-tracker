import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Baby, Household } from '../types/models'
import { HouseholdProvider, useHousehold } from './HouseholdContext'

const subscribeToHouseholdForUser = vi.fn()
const subscribeToBabies = vi.fn()

vi.mock('../repositories/households', () => ({
  subscribeToHouseholdForUser: (...args: unknown[]) => subscribeToHouseholdForUser(...args),
}))
vi.mock('../repositories/babies', () => ({
  subscribeToBabies: (...args: unknown[]) => subscribeToBabies(...args),
}))
const mockUser = { uid: 'uid1' } as User
vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const household: Household = { id: 'h1', name: 'Famille Test', memberUids: ['uid1'] }
const babies: Baby[] = [
  { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null },
  { id: 'b2', name: 'Nina', birthDate: '2026-01-15', sex: null },
]

const selectBabyIdentities = new Set<unknown>()

function Probe() {
  const { household: h, babies: b, loading, error, selectedBaby, selectBaby } = useHousehold()
  selectBabyIdentities.add(selectBaby)
  return (
    <div>
      <span data-role="loading">{String(loading)}</span>
      <span data-role="error">error:{error ?? 'none'}</span>
      <span data-role="household">household:{h?.name ?? 'none'}</span>
      <span data-role="selected">selected:{selectedBaby?.name ?? 'none'}</span>
      {b.map((baby) => (
        <button key={baby.id} type="button" onClick={() => selectBaby(baby.id)}>
          {baby.name}
        </button>
      ))}
    </div>
  )
}

describe('HouseholdContext', () => {
  beforeEach(() => {
    subscribeToHouseholdForUser.mockReset()
    subscribeToBabies.mockReset()
    localStorage.clear()
    selectBabyIdentities.clear()
  })

  it('resolves the household then the babies, defaulting to the first baby', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(household)
      return vi.fn()
    })
    subscribeToBabies.mockImplementation((_householdId, onChange) => {
      onChange(babies)
      return vi.fn()
    })

    render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>,
    )

    await waitFor(() => expect(screen.getByText('household:Famille Test')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('selected:Léo')).toBeInTheDocument())
    expect(screen.getByText('false')).toBeInTheDocument()
  })

  it('lets the user pick a different baby and persists the choice', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(household)
      return vi.fn()
    })
    subscribeToBabies.mockImplementation((_householdId, onChange) => {
      onChange(babies)
      return vi.fn()
    })
    const user = userEvent.setup()

    render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>,
    )

    await waitFor(() => expect(screen.getByText('selected:Léo')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Nina' }))

    await waitFor(() => expect(screen.getByText('selected:Nina')).toBeInTheDocument())
    expect(localStorage.getItem('baby-tracker:selectedBabyId')).toBe('b2')
  })

  it('stops loading with no household when the user has none', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(null)
      return vi.fn()
    })

    render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>,
    )

    await waitFor(() => expect(screen.getByText('false')).toBeInTheDocument())
    expect(screen.getByText('household:none')).toBeInTheDocument()
    expect(subscribeToBabies).not.toHaveBeenCalled()
  })

  it('throws when useHousehold is used outside HouseholdProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useHousehold must be used within a HouseholdProvider')
    consoleErrorSpy.mockRestore()
  })

  describe('listeners', () => {
    type HouseholdListener = { onChange: (h: Household | null) => void; onError: (e: Error) => void }
    type BabiesListener = { householdId: string; onChange: (b: Baby[]) => void; onError: (e: Error) => void }
    let householdListener: HouseholdListener
    let babiesListeners: BabiesListener[]
    let unsubscribeHousehold: ReturnType<typeof vi.fn>
    let unsubscribeBabies: ReturnType<typeof vi.fn>

    beforeEach(() => {
      babiesListeners = []
      unsubscribeHousehold = vi.fn()
      unsubscribeBabies = vi.fn()
      subscribeToHouseholdForUser.mockImplementation((_uid, onChange, onError) => {
        householdListener = { onChange, onError }
        return unsubscribeHousehold
      })
      subscribeToBabies.mockImplementation((householdId, onChange, onError) => {
        babiesListeners.push({ householdId, onChange, onError })
        return unsubscribeBabies
      })
    })

    function renderProvider() {
      return render(
        <HouseholdProvider>
          <Probe />
        </HouseholdProvider>,
      )
    }

    it('stays loading while the household is not known (e.g. an empty cached snapshot is ignored)', () => {
      renderProvider()

      expect(screen.getByText('true')).toBeInTheDocument()
      expect(subscribeToBabies).not.toHaveBeenCalled()
    })

    it('stays loading until the babies answer', () => {
      renderProvider()

      act(() => householdListener.onChange(household))
      expect(screen.getByText('true')).toBeInTheDocument()
      expect(screen.getByText('household:Famille Test')).toBeInTheDocument()

      act(() => babiesListeners[0].onChange(babies))
      expect(screen.getByText('false')).toBeInTheDocument()
    })

    it('falls back to the first baby when the stored one was deleted', () => {
      localStorage.setItem('baby-tracker:selectedBabyId', 'ghost')
      renderProvider()

      act(() => householdListener.onChange(household))
      act(() => babiesListeners[0].onChange(babies))

      expect(screen.getByText('selected:Léo')).toBeInTheDocument()
    })

    it('resets the babies when the household goes away', () => {
      renderProvider()
      act(() => householdListener.onChange(household))
      act(() => babiesListeners[0].onChange(babies))

      act(() => householdListener.onChange(null))

      expect(screen.getByText('household:none')).toBeInTheDocument()
      expect(screen.getByText('selected:none')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Léo' })).not.toBeInTheDocument()
      expect(unsubscribeBabies).toHaveBeenCalled()
    })

    it('keeps the babies subscription when the household document changes', () => {
      renderProvider()
      act(() => householdListener.onChange(household))
      act(() => babiesListeners[0].onChange(babies))

      act(() => householdListener.onChange({ ...household, name: 'Renamed' }))

      expect(screen.getByText('household:Renamed')).toBeInTheDocument()
      expect(subscribeToBabies).toHaveBeenCalledTimes(1)
      expect(unsubscribeBabies).not.toHaveBeenCalled()
    })

    it('reports a subscription error, then clears it on the next successful snapshot', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      renderProvider()

      act(() => householdListener.onError(new Error('permission-denied')))

      expect(screen.getByText('error:permission-denied')).toBeInTheDocument()
      expect(screen.getByText('false')).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalledWith('[household] subscription failed', expect.any(Error))

      act(() => householdListener.onChange(household))
      expect(screen.getByText('error:none')).toBeInTheDocument()

      act(() => babiesListeners[0].onError(new Error('babies denied')))
      expect(screen.getByText('error:babies denied')).toBeInTheDocument()

      act(() => babiesListeners[0].onChange(babies))
      expect(screen.getByText('error:none')).toBeInTheDocument()
      consoleError.mockRestore()
    })

    it('unsubscribes from the household and the babies on unmount', () => {
      const { unmount } = renderProvider()
      act(() => householdListener.onChange(household))

      unmount()

      expect(unsubscribeHousehold).toHaveBeenCalled()
      expect(unsubscribeBabies).toHaveBeenCalled()
    })

    it('keeps selectBaby stable across renders', () => {
      renderProvider()

      act(() => householdListener.onChange(household))
      act(() => babiesListeners[0].onChange(babies))

      expect(selectBabyIdentities.size).toBe(1)
    })
  })
})
