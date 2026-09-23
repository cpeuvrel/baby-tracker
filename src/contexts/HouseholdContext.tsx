import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { subscribeToBabies } from '../repositories/babies'
import { subscribeToHouseholdForUser } from '../repositories/households'
import type { Baby, Household } from '../types/models'
import { useAuth } from './AuthContext'

const SELECTED_BABY_STORAGE_KEY = 'baby-tracker:selectedBabyId'

interface HouseholdContextValue {
  household: Household | null
  babies: Baby[]
  loading: boolean
  error: string | null
  selectedBaby: Baby | null
  selectBaby: (babyId: string) => void
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined)

function readStoredBabyId(): string | null {
  try {
    return localStorage.getItem(SELECTED_BABY_STORAGE_KEY)
  } catch {
    return null
  }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState<Household | null>(null)
  const [babies, setBabies] = useState<Baby[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(readStoredBabyId)

  useEffect(() => {
    if (!user) {
      setHousehold(null)
      setBabies([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    return subscribeToHouseholdForUser(
      user.uid,
      (nextHousehold) => {
        setHousehold(nextHousehold)
        if (!nextHousehold) {
          setBabies([])
          setLoading(false)
        }
      },
      (subscriptionError) => {
        console.error('[household] subscription failed', subscriptionError)
        setError(subscriptionError.message)
        setLoading(false)
      },
    )
  }, [user])

  useEffect(() => {
    if (!household) return
    return subscribeToBabies(
      household.id,
      (nextBabies) => {
        setBabies(nextBabies)
        setLoading(false)
      },
      (subscriptionError) => {
        console.error('[babies] subscription failed', subscriptionError)
        setError(subscriptionError.message)
        setLoading(false)
      },
    )
  }, [household])

  const selectedBaby = useMemo(
    () => babies.find((baby) => baby.id === selectedBabyId) ?? babies[0] ?? null,
    [babies, selectedBabyId],
  )

  const selectBaby = (babyId: string) => {
    setSelectedBabyId(babyId)
    try {
      localStorage.setItem(SELECTED_BABY_STORAGE_KEY, babyId)
    } catch {
      /* storage unavailable (private browsing): the selection stays in memory */
    }
  }

  return (
    <HouseholdContext.Provider value={{ household, babies, loading, error, selectedBaby, selectBaby }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider')
  }
  return context
}
