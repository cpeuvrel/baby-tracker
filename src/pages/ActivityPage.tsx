import { useState } from 'react'
import { CategoryCard } from '../components/CategoryCard'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { GrowthForm } from '../components/GrowthForm'
import { DiaperIcon, FeedIcon, GrowthIcon, MedicationIcon, SleepIcon } from '../components/icons'
import { MedicationForm } from '../components/MedicationForm'
import { Modal } from '../components/Modal'
import { ReminderSettingsModal } from '../components/ReminderSettingsModal'
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

const RECENT_COUNT = 5
const DEFAULT_MEDICATION_NAME = 'Vitamine D'

type ModalKind = 'sleep' | 'feeding' | 'diaper' | 'growth' | 'medication' | 'reminder' | null

export function ActivityPage() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [openModal, setOpenModal] = useState<ModalKind>(null)

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
    setOpenModal('sleep')
  }

  const closeModal = () => setOpenModal(null)

  return (
    <div>
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={handleAddSleep}
        icon={<SleepIcon />}
        primary={recentSleep[0] ? summarizeSleepPrimary(recentSleep[0], now) : null}
        emptyLabel="Aucune entrée"
        moreLines={recentSleep.slice(1).map((entry) => summarizeSleepEntry(entry, now))}
      />
      <CategoryCard
        title="Nourriture"
        colorVar="--category-feeding"
        addLabel="Ajouter une entrée nourriture"
        onAdd={() => setOpenModal('feeding')}
        icon={<FeedIcon />}
        primary={latestFeeding ? summarizeFeedingPrimary(latestFeeding, now) : null}
        emptyLabel="Aucune entrée"
        moreLines={recentFeeding.slice(1).map((entry) => summarizeFeedingEntry(entry, now))}
        highlight={feedingHighlight}
      />
      <CategoryCard
        title="Couches"
        colorVar="--category-diaper"
        addLabel="Ajouter une couche"
        onAdd={() => setOpenModal('diaper')}
        icon={<DiaperIcon />}
        primary={recentDiaper[0] ? summarizeDiaperPrimary(recentDiaper[0], now) : null}
        emptyLabel="Aucune entrée"
        moreLines={recentDiaper.slice(1).map((entry) => summarizeDiaperEntry(entry, now))}
      />
      <CategoryCard
        title="Médicament"
        colorVar="--category-medication"
        addLabel="Ajouter une prise"
        onAdd={() => setOpenModal('medication')}
        icon={<MedicationIcon />}
        primary={recentMedication[0] ? summarizeMedicationPrimary(recentMedication[0], now) : null}
        emptyLabel="Aucune prise"
        moreLines={recentMedication.slice(1).map((entry) => summarizeMedicationEntry(entry, now))}
        secondaryAction={{ label: 'Régler le rappel', onClick: () => setOpenModal('reminder') }}
      />
      <CategoryCard
        title="Croissance"
        colorVar="--category-growth"
        addLabel="Ajouter une mesure"
        onAdd={() => setOpenModal('growth')}
        icon={<GrowthIcon />}
        primary={recentGrowth[0] ? summarizeGrowthPrimary(recentGrowth[0], now) : null}
        emptyLabel="Aucune mesure"
        moreLines={recentGrowth.slice(1).map((entry) => summarizeGrowthEntry(entry, now))}
      />

      {openModal === 'sleep' && <SleepTimerModal onClose={closeModal} />}
      {openModal === 'feeding' && (
        <Modal title="Nourriture" bandColorVar="--category-feeding" onClose={closeModal}>
          <FeedingForm onSaved={closeModal} />
        </Modal>
      )}
      {openModal === 'diaper' && (
        <Modal title="Couches" bandColorVar="--category-diaper" onClose={closeModal}>
          <DiaperForm onSaved={closeModal} />
        </Modal>
      )}
      {openModal === 'medication' && (
        <Modal title="Médicament" bandColorVar="--category-medication" onClose={closeModal}>
          <MedicationForm onSaved={closeModal} />
        </Modal>
      )}
      {openModal === 'reminder' && (
        <ReminderSettingsModal medicationName={DEFAULT_MEDICATION_NAME} onClose={closeModal} />
      )}
      {openModal === 'growth' && (
        <Modal title="Croissance" bandColorVar="--category-growth" onClose={closeModal}>
          <GrowthForm onSaved={closeModal} />
        </Modal>
      )}
    </div>
  )
}
