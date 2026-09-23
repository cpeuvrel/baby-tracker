import { useState } from 'react'

const UNIT_STORAGE_KEY = 'baby-tracker:unitSystem'

export type UnitSystem = 'metric' | 'imperial'

function readStoredUnit(): UnitSystem {
  try {
    return localStorage.getItem(UNIT_STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export function useUnitPreference(): [UnitSystem, (unit: UnitSystem) => void] {
  const [unit, setUnitState] = useState<UnitSystem>(readStoredUnit)

  const setUnit = (next: UnitSystem) => {
    setUnitState(next)
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, next)
    } catch {
      /* storage unavailable (private browsing): preference kept in memory for the session */
    }
  }

  return [unit, setUnit]
}
