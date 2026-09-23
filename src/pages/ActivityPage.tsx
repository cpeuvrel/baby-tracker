import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryCard, type CategoryCardEntryRow } from '../components/CategoryCard'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { GrowthForm } from '../components/GrowthForm'
import {
  DiaperIcon,
  FeedIcon,
  GrowthIcon,
  HeadCircumferenceIcon,
  MedicationIcon,
  RulerIcon,
  ScaleIcon,
  SleepIcon,
  TimerIcon,
} from '../components/icons'
import { MedicationForm } from '../components/MedicationForm'
import { ReminderSettingsModal } from '../components/ReminderSettingsModal'
import { SleepEntryEditModal } from '../components/SleepEntryEditModal'
import { SleepTimerModal } from '../components/SleepTimerModal'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActivityVisibility } from '../hooks/useActivityVisibility'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useGrowthEntries } from '../hooks/useGrowthEntries'
import { useRecentDiaperEntries } from '../hooks/useRecentDiaperEntries'
import { useRecentFeedingEntries } from '../hooks/useRecentFeedingEntries'
import { useRecentMedicationEntries } from '../hooks/useRecentMedicationEntries'
import { useRecentSleepEntries } from '../hooks/useRecentSleepEntries'
import { useUnitPreference } from '../hooks/useUnitPreference'
import {
  latestGrowthEntryWithField,
  summarizeDiaperPrimary,
  summarizeDiaperRow,
  summarizeFeedingPrimary,
  summarizeFeedingRow,
  summarizeMedicationPrimary,
  summarizeMedicationRow,
  summarizeSleepPrimary,
  summarizeSleepRow,
  type EntryRow,
} from '../lib/entrySummary'
import { formatGrowthValue, GROWTH_METRIC_FIELD, GROWTH_METRIC_LABELS, type GrowthMetric } from '../lib/growthMetrics'
import { isToday } from '../lib/timeline'
import type {
  DiaperEntry,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

const RECENT_COUNT = 5
const DEFAULT_MEDICATION_NAME = 'Vitamin D'

function splitTodayLines<T>(
  entries: T[],
  now: Date,
  getIso: (entry: T) => string,
  summarize: (entry: T) => EntryRow,
  onSelect: (entry: T) => void,
  icon: ReactNode,
): { today: CategoryCardEntryRow[]; older: CategoryCardEntryRow[] } {
  const today: CategoryCardEntryRow[] = []
  const older: CategoryCardEntryRow[] = []
  for (const entry of entries) {
    const row: CategoryCardEntryRow = { ...summarize(entry), icon, onClick: () => onSelect(entry) }
    if (isToday(getIso(entry), now)) {
      today.push(row)
    } else {
      older.push(row)
    }
  }
  return { today, older }
}

const GROWTH_METRIC_ICONS: Record<GrowthMetric, typeof ScaleIcon> = {
  weight: ScaleIcon,
  height: RulerIcon,
  headCircumference: HeadCircumferenceIcon,
}

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
  const navigate = useNavigate()
  const [modal, setModal] = useState<ModalState>(null)
  const [unit] = useUnitPreference()
  const { isVisible } = useActivityVisibility()

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
  const latestFeeding = recentFeeding[0]
  const feedingHighlight =
    latestFeeding?.type === 'bottle' && latestFeeding.volumeMl != null
      ? { value: String(latestFeeding.volumeMl), unit: 'mL' }
      : undefined

  const handleAddSleep = () => {
    setModal({ kind: 'sleep-active' })
  }

  const handleSelectSleep = (entry: SleepEntry) => {
    setModal(entry.endedAt === null ? { kind: 'sleep-active' } : { kind: 'sleep-edit', entry })
  }

  const closeModal = () => setModal(null)

  const handleShowHistory = () => navigate('/history')

  const maxSleepSeconds = Math.max(
    0,
    ...recentSleep.filter((entry) => entry.durationSeconds != null).map((entry) => entry.durationSeconds as number),
  )
  const { today: sleepTodayLines, older: sleepMoreLines } = splitTodayLines(
    recentSleep,
    now,
    (entry) => entry.endedAt ?? entry.startedAt,
    (entry) => summarizeSleepRow(entry, now, maxSleepSeconds),
    handleSelectSleep,
    <SleepIcon />,
  )

  const maxVolumeMl = Math.max(
    0,
    ...recentFeeding
      .filter((entry) => entry.type === 'bottle' && entry.volumeMl != null)
      .map((entry) => entry.volumeMl as number),
  )
  const { today: feedingTodayLines, older: feedingMoreLines } = splitTodayLines(
    recentFeeding,
    now,
    (entry) => entry.occurredAt,
    (entry) => summarizeFeedingRow(entry, maxVolumeMl),
    (entry) => setModal({ kind: 'feeding', entry }),
    <FeedIcon />,
  )

  const { today: diaperTodayLines, older: diaperMoreLines } = splitTodayLines(
    recentDiaper,
    now,
    (entry) => entry.occurredAt,
    (entry) => summarizeDiaperRow(entry),
    (entry) => setModal({ kind: 'diaper', entry }),
    <DiaperIcon />,
  )

  const { today: medicationTodayLines, older: medicationMoreLines } = splitTodayLines(
    recentMedication,
    now,
    (entry) => entry.givenAt,
    (entry) => summarizeMedicationRow(entry),
    (entry) => setModal({ kind: 'medication', entry }),
    <MedicationIcon />,
  )

  const growthRows: CategoryCardEntryRow[] = (['weight', 'height', 'headCircumference'] as GrowthMetric[]).map(
    (metric) => {
      const field = GROWTH_METRIC_FIELD[metric]
      const entry = latestGrowthEntryWithField(growthEntries, field as 'weightG' | 'heightMm' | 'headCircumferenceMm')
      const value = entry ? (entry[field] as number | null) : null
      const RowIcon = GROWTH_METRIC_ICONS[metric]
      return {
        icon: <RowIcon />,
        title: GROWTH_METRIC_LABELS[metric],
        value: value != null ? formatGrowthValue(metric, value, unit) : undefined,
        onClick: () => navigate(`/growth/${metric}`),
      }
    },
  )

  return (
    <div>
      {isVisible('sleep') && (
        <CategoryCard
          title="Sleep"
          colorVar="--category-sleep"
          addLabel={activeSleepEntry ? 'View the running timer' : 'Add a sleep entry'}
          onAdd={handleAddSleep}
          addIcon={activeSleepEntry ? <TimerIcon /> : undefined}
          addActive={!!activeSleepEntry}
          icon={<SleepIcon />}
          primary={recentSleep[0] ? summarizeSleepPrimary(recentSleep[0], now) : null}
          onSelectPrimary={recentSleep[0] ? () => handleSelectSleep(recentSleep[0]) : undefined}
          emptyLabel="No entries"
          todayLines={sleepTodayLines}
          moreLines={sleepMoreLines}
          onShowHistory={handleShowHistory}
        />
      )}
      {isVisible('feeding') && (
        <CategoryCard
          title="Feed"
          colorVar="--category-feeding"
          addLabel="Add a feeding entry"
          onAdd={() => setModal({ kind: 'feeding' })}
          icon={<FeedIcon />}
          primary={latestFeeding ? summarizeFeedingPrimary(latestFeeding, now) : null}
          onSelectPrimary={latestFeeding ? () => setModal({ kind: 'feeding', entry: latestFeeding }) : undefined}
          emptyLabel="No entries"
          todayLines={feedingTodayLines}
          moreLines={feedingMoreLines}
          onShowHistory={handleShowHistory}
          highlight={feedingHighlight}
        />
      )}
      {isVisible('diaper') && (
        <CategoryCard
          title="Diaper"
          colorVar="--category-diaper"
          addLabel="Add a diaper change"
          onAdd={() => setModal({ kind: 'diaper' })}
          icon={<DiaperIcon />}
          primary={recentDiaper[0] ? summarizeDiaperPrimary(recentDiaper[0], now) : null}
          onSelectPrimary={recentDiaper[0] ? () => setModal({ kind: 'diaper', entry: recentDiaper[0] }) : undefined}
          emptyLabel="No entries"
          todayLines={diaperTodayLines}
          moreLines={diaperMoreLines}
          onShowHistory={handleShowHistory}
        />
      )}
      {isVisible('medication') && (
        <CategoryCard
          title="Medication"
          colorVar="--category-medication"
          addLabel="Add a dose"
          onAdd={() => setModal({ kind: 'medication' })}
          icon={<MedicationIcon />}
          primary={recentMedication[0] ? summarizeMedicationPrimary(recentMedication[0], now) : null}
          onSelectPrimary={
            recentMedication[0] ? () => setModal({ kind: 'medication', entry: recentMedication[0] }) : undefined
          }
          emptyLabel="No doses"
          todayLines={medicationTodayLines}
          moreLines={medicationMoreLines}
          onShowHistory={handleShowHistory}
          secondaryAction={{ label: 'Set reminder', onClick: () => setModal({ kind: 'reminder' }) }}
        />
      )}
      {isVisible('growth') && (
        <CategoryCard
          title="Growth"
          colorVar="--category-growth"
          addLabel="Add a measurement"
          onAdd={() => setModal({ kind: 'growth' })}
          icon={<GrowthIcon />}
          showPrimary={false}
          primary={null}
          emptyLabel="No measurements"
          todayLines={growthRows}
          moreLines={[]}
        />
      )}

      {modal?.kind === 'sleep-active' && <SleepTimerModal onClose={closeModal} />}
      {modal?.kind === 'sleep-edit' && <SleepEntryEditModal entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'feeding' && <FeedingForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'diaper' && <DiaperForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'medication' && <MedicationForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'reminder' && (
        <ReminderSettingsModal medicationName={DEFAULT_MEDICATION_NAME} onClose={closeModal} />
      )}
      {modal?.kind === 'growth' && <GrowthForm entry={modal.entry} onClose={closeModal} />}
    </div>
  )
}
