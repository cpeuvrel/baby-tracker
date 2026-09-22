import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveBottleFeeding } from '../hooks/useActiveBottleFeeding'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { formatDuration } from '../lib/duration'
import { logSolidFeeding, startBottleFeeding, stopBottleFeeding } from '../repositories/feedingEntries'

export function FeedingCard() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const activeEntry = useActiveBottleFeeding(household?.id ?? null, selectedBaby?.id ?? null)
  const elapsedSeconds = useElapsedSeconds(activeEntry?.startedAt ?? null)
  const [volumeMl, setVolumeMl] = useState('')
  const [solidNotes, setSolidNotes] = useState('')

  if (!household || !selectedBaby || !user) return null

  const handleStartBottle = () => {
    void startBottleFeeding(household.id, selectedBaby.id, user.uid)
  }

  const handleStopBottle = () => {
    if (!activeEntry) return
    const parsedVolume = volumeMl.trim() === '' ? null : Number(volumeMl)
    void stopBottleFeeding(
      household.id,
      selectedBaby.id,
      activeEntry.id,
      new Date(activeEntry.startedAt),
      parsedVolume,
    )
    setVolumeMl('')
  }

  const handleLogSolid = () => {
    void logSolidFeeding(household.id, selectedBaby.id, user.uid, solidNotes)
    setSolidNotes('')
  }

  return (
    <section aria-label="Nourriture">
      <h2>Nourriture</h2>
      <div>
        <h3>Biberon</h3>
        {activeEntry ? (
          <>
            <p aria-live="polite">En cours depuis {formatDuration(elapsedSeconds)}</p>
            <label htmlFor="feeding-volume">Volume (mL)</label>
            <input
              id="feeding-volume"
              type="number"
              min="0"
              inputMode="numeric"
              value={volumeMl}
              onChange={(event) => setVolumeMl(event.target.value)}
            />
            <button type="button" onClick={handleStopBottle}>
              Arrêter le biberon
            </button>
          </>
        ) : (
          <button type="button" onClick={handleStartBottle}>
            Démarrer le biberon
          </button>
        )}
      </div>
      <div>
        <h3>Solide</h3>
        <label htmlFor="solid-notes">Aliment (optionnel)</label>
        <input
          id="solid-notes"
          type="text"
          value={solidNotes}
          onChange={(event) => setSolidNotes(event.target.value)}
        />
        <button type="button" onClick={handleLogSolid}>
          Enregistrer le repas
        </button>
      </div>
    </section>
  )
}
