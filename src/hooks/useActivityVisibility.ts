import { useState } from 'react'

const STORAGE_KEY = 'baby-tracker:hiddenActivities'

export type ActivityCategory = 'feeding' | 'sleep' | 'diaper' | 'growth' | 'routine'

export const ACTIVITY_CATEGORIES: { id: ActivityCategory; label: string }[] = [
  { id: 'feeding', label: 'Feeding' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'diaper', label: 'Diaper Changes' },
  { id: 'growth', label: 'Growth' },
  { id: 'routine', label: 'Routine (bath, vitamin)' },
]

function readHidden(): ActivityCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActivityCategory[]) : []
  } catch {
    return []
  }
}

function writeHidden(hidden: ActivityCategory[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden))
  } catch {
    /* storage unavailable (private browsing): preference kept in memory for the session */
  }
}

export function useActivityVisibility(): {
  isVisible: (category: ActivityCategory) => boolean
  toggle: (category: ActivityCategory) => void
} {
  const [hidden, setHidden] = useState<ActivityCategory[]>(readHidden)

  const toggle = (category: ActivityCategory) => {
    const next = hidden.includes(category)
      ? hidden.filter((entry) => entry !== category)
      : [...hidden, category]
    setHidden(next)
    writeHidden(next)
  }

  return { isVisible: (category) => !hidden.includes(category), toggle }
}
