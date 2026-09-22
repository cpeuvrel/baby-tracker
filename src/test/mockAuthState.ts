import type { User } from 'firebase/auth'

type AuthStateListener = (user: User | null) => void

export function createMockAuth() {
  const listeners = new Set<AuthStateListener>()

  return {
    subscribe(listener: AuthStateListener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(user: User | null) {
      for (const listener of listeners) listener(user)
    },
  }
}
