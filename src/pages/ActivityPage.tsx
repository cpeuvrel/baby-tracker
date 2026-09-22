import { useState } from 'react'
import { CategoryCard } from '../components/CategoryCard'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { GrowthForm } from '../components/GrowthForm'
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
  summarizeFeedingEntry,
  summarizeGrowthEntry,
  summarizeMedicationEntry,
  summarizeSleepEntry,
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
        lines={recentSleep.map((entry) => summarizeSleepEntry(entry, now))}
        emptyLabel="Aucune entrée"
      />
      <CategoryCard
        title="Nourriture"
        colorVar="--category-feeding"
        addLabel="Ajouter une entrée nourriture"
        onAdd={() => setOpenModal('feeding')}
        lines={recentFeeding.map((entry) => summarizeFeedingEntry(entry, now))}
        emptyLabel="Aucune entrée"
      />
      <CategoryCard
        title="Couches"
        colorVar="--category-diaper"
        addLabel="Ajouter une couche"
        onAdd={() => setOpenModal('diaper')}
        lines={recentDiaper.map((entry) => summarizeDiaperEntry(entry, now))}
        emptyLabel="Aucune entrée"
      />
      <CategoryCard
        title="Médicament"
        colorVar="--category-medication"
        addLabel="Ajouter une prise"
        onAdd={() => setOpenModal('medication')}
        lines={recentMedication.map((entry) => summarizeMedicationEntry(entry, now))}
        emptyLabel="Aucune prise"
        secondaryAction={{ label: 'Régler le rappel', onClick: () => setOpenModal('reminder') }}
      />
      <CategoryCard
        title="Croissance"
        colorVar="--category-growth"
        addLabel="Ajouter une mesure"
        onAdd={() => setOpenModal('growth')}
        lines={recentGrowth.map((entry) => summarizeGrowthEntry(entry, now))}
        emptyLabel="Aucune mesure"
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
