import { useState } from 'react'
import { CategoryCard, type CategoryCardMoreLine } from '../components/CategoryCard'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { GrowthForm } from '../components/GrowthForm'
import { DiaperIcon, FeedIcon, GrowthIcon, MedicationIcon, SleepIcon } from '../components/icons'
import { MedicationForm } from '../components/MedicationForm'
import { Modal } from '../components/Modal'
import { ReminderSettingsModal } from '../components/ReminderSettingsModal'
import { SleepEntryEditModal } from '../components/SleepEntryEditModal'
import { SleepTimerModal } from '../components/SleepTimerModal'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useGrowthEntries } from '../hooks/useGrowthEntries'
import { useRecentDiaperEntries } from '../hooks/useRecentDiaperEntries'
import { useRecentFeedingEntries } from '../hooks/useRecentFeedingEntries'
import { useRecentMedicationEntries } from '../hooks/useRecentMedicationEntries'
import { useRecentSleepEntries } from '../hooks/useRecentSleepEntries'
import {
  summarizeDiaperEntry,
  summarizeDiaperPrimary,
  summarizeFeedingEntry,
  summarizeFeedingPrimary,
  summarizeGrowthEntry,
  summarizeGrowthPrimary,
  summarizeMedicationEntry,
  summarizeMedicationPrimary,
  summarizeSleepEntry,
  summarizeSleepPrimary,
} from '../lib/entrySummary'
import { startSleep } from '../repositories/sleepEntries'
import type {
  DiaperEntry,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

const RECENT_COUNT = 5
const DEFAULT_MEDICATION_NAME = 'Vitamine D'

type ModalState =
  | { kind: 'sleep-active' }
  | { kind: 'sleep-edit'; entry: SleepEntry }
  | { kind: 'feeding'; entry?: FeedingEntry }
  | { kind: 'diaper'; entry?: DiaperEntry }
  | { kind: 'medication'; entry?: MedicationEntry }
  | { kind: 'growth'; entry?: GrowthEntry }
  | { kind: 'reminder' }
  | null

export function ActivityPage() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [modal, setModal] = useState<ModalState>(null)

  const activeSleepEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const recentSleep = useRecentSleepEntries(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    RECENT_COUNT,
  )
  const recentFeeding = useRecentFeedingEntries(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    RECENT_COUNT,
  )
  const recentDiaper = useRecentDiaperEntries(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    RECENT_COUNT,
  )
  const recentMedication = useRecentMedicationEntries(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    RECENT_COUNT,
  )
  const growthEntries = useGrowthEntries(household?.id ?? null, selectedBaby?.id ?? null)

  if (!household || !selectedBaby || !user) return null

  const now = new Date()
  const recentGrowth = [...growthEntries].reverse().slice(0, RECENT_COUNT)
  const latestFeeding = recentFeeding[0]
  const feedingHighlight =
    latestFeeding?.type === 'bottle' && latestFeeding.volumeMl != null
      ? { value: String(latestFeeding.volumeMl), unit: 'mL' }
      : undefined

  const handleAddSleep = () => {
    if (!activeSleepEntry) {
      void startSleep(household.id, selectedBaby.id, user.uid)
    }
    setModal({ kind: 'sleep-active' })
  }

  const handleSelectSleep = (entry: SleepEntry) => {
    setModal(entry.endedAt === null ? { kind: 'sleep-active' } : { kind: 'sleep-edit', entry })
  }

  const closeModal = () => setModal(null)

  const sleepMoreLines: CategoryCardMoreLine[] = recentSleep
    .slice(1)
    .map((entry) => ({ text: summarizeSleepEntry(entry, now), onClick: () => handleSelectSleep(entry) }))
  const feedingMoreLines: CategoryCardMoreLine[] = recentFeeding.slice(1).map((entry) => ({
    text: summarizeFeedingEntry(entry, now),
    onClick: () => setModal({ kind: 'feeding', entry }),
  }))
  const diaperMoreLines: CategoryCardMoreLine[] = recentDiaper.slice(1).map((entry) => ({
    text: summarizeDiaperEntry(entry, now),
    onClick: () => setModal({ kind: 'diaper', entry }),
  }))
  const medicationMoreLines: CategoryCardMoreLine[] = recentMedication.slice(1).map((entry) => ({
    text: summarizeMedicationEntry(entry, now),
    onClick: () => setModal({ kind: 'medication', entry }),
  }))
  const growthMoreLines: CategoryCardMoreLine[] = recentGrowth.slice(1).map((entry) => ({
    text: summarizeGrowthEntry(entry, now),
    onClick: () => setModal({ kind: 'growth', entry }),
  }))

  return (
    <div>
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={handleAddSleep}
        icon={<SleepIcon />}
        primary={recentSleep[0] ? summarizeSleepPrimary(recentSleep[0], now) : null}
        onSelectPrimary={recentSleep[0] ? () => handleSelectSleep(recentSleep[0]) : undefined}
        emptyLabel="Aucune entrée"
        moreLines={sleepMoreLines}
      />
      <CategoryCard
        title="Nourriture"
        colorVar="--category-feeding"
        addLabel="Ajouter une entrée nourriture"
        onAdd={() => setModal({ kind: 'feeding' })}
        icon={<FeedIcon />}
        primary={latestFeeding ? summarizeFeedingPrimary(latestFeeding, now) : null}
        onSelectPrimary={latestFeeding ? () => setModal({ kind: 'feeding', entry: latestFeeding }) : undefined}
        emptyLabel="Aucune entrée"
        moreLines={feedingMoreLines}
        highlight={feedingHighlight}
      />
      <CategoryCard
        title="Couches"
        colorVar="--category-diaper"
        addLabel="Ajouter une couche"
        onAdd={() => setModal({ kind: 'diaper' })}
        icon={<DiaperIcon />}
        primary={recentDiaper[0] ? summarizeDiaperPrimary(recentDiaper[0], now) : null}
        onSelectPrimary={recentDiaper[0] ? () => setModal({ kind: 'diaper', entry: recentDiaper[0] }) : undefined}
        emptyLabel="Aucune entrée"
        moreLines={diaperMoreLines}
      />
      <CategoryCard
        title="Médicament"
        colorVar="--category-medication"
        addLabel="Ajouter une prise"
        onAdd={() => setModal({ kind: 'medication' })}
        icon={<MedicationIcon />}
        primary={recentMedication[0] ? summarizeMedicationPrimary(recentMedication[0], now) : null}
        onSelectPrimary={
          recentMedication[0] ? () => setModal({ kind: 'medication', entry: recentMedication[0] }) : undefined
        }
        emptyLabel="Aucune prise"
        moreLines={medicationMoreLines}
        secondaryAction={{ label: 'Régler le rappel', onClick: () => setModal({ kind: 'reminder' }) }}
      />
      <CategoryCard
        title="Croissance"
        colorVar="--category-growth"
        addLabel="Ajouter une mesure"
        onAdd={() => setModal({ kind: 'growth' })}
        icon={<GrowthIcon />}
        primary={recentGrowth[0] ? summarizeGrowthPrimary(recentGrowth[0], now) : null}
        onSelectPrimary={recentGrowth[0] ? () => setModal({ kind: 'growth', entry: recentGrowth[0] }) : undefined}
        emptyLabel="Aucune mesure"
        moreLines={growthMoreLines}
      />

      {modal?.kind === 'sleep-active' && <SleepTimerModal onClose={closeModal} />}
      {modal?.kind === 'sleep-edit' && <SleepEntryEditModal entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'feeding' && (
        <Modal title="Nourriture" bandColorVar="--category-feeding" onClose={closeModal}>
          <FeedingForm entry={modal.entry} onSaved={closeModal} />
        </Modal>
      )}
      {modal?.kind === 'diaper' && (
        <Modal title="Couches" bandColorVar="--category-diaper" onClose={closeModal}>
          <DiaperForm entry={modal.entry} onSaved={closeModal} />
        </Modal>
      )}
      {modal?.kind === 'medication' && (
        <Modal title="Médicament" bandColorVar="--category-medication" onClose={closeModal}>
          <MedicationForm entry={modal.entry} onSaved={closeModal} />
        </Modal>
      )}
      {modal?.kind === 'reminder' && (
        <ReminderSettingsModal medicationName={DEFAULT_MEDICATION_NAME} onClose={closeModal} />
      )}
      {modal?.kind === 'growth' && (
        <Modal title="Croissance" bandColorVar="--category-growth" onClose={closeModal}>
          <GrowthForm entry={modal.entry} onSaved={closeModal} />
        </Modal>
      )}
    </div>
  )
}
