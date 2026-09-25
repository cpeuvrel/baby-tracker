import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BathForm } from '../components/BathForm'
import { CategoryCard, type CategoryCardEntryRow } from '../components/CategoryCard'
import { DiaperForm } from '../components/DiaperForm'
import { FeedingForm } from '../components/FeedingForm'
import { GrowthForm } from '../components/GrowthForm'
import {
  DiaperIcon,
  FeedIcon,
  GrowthIcon,
  HeadCircumferenceIcon,
  BathIcon,
  MedicationIcon,
  RoutineIcon,
  VitaminIcon,
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
import { useRecentBathEntries } from '../hooks/useRecentBathEntries'
import { useRecentDiaperEntries } from '../hooks/useRecentDiaperEntries'
import { useRecentFeedingEntries } from '../hooks/useRecentFeedingEntries'
import { useRecentMedicationEntries } from '../hooks/useRecentMedicationEntries'
import { useRecentSleepEntries } from '../hooks/useRecentSleepEntries'
import { useUnitPreference } from '../hooks/useUnitPreference'
import {
  latestGrowthEntryWithField,
  DIAPER_SHORT_LABELS,
  summarizeBathRow,
  summarizeDiaperPrimary,
  summarizeDiaperRow,
  summarizeFeedingPrimary,
  summarizeFeedingRow,
  summarizeMedicationRow,
  summarizeSleepPrimary,
  summarizeSleepRow,
  type EntryRow,
} from '../lib/entrySummary'
import { formatGrowthValue, GROWTH_METRIC_FIELD, GROWTH_METRIC_LABELS, type GrowthMetric } from '../lib/growthMetrics'
import { DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { formatDate } from '../lib/appTime'
import { formatRelativeTime } from '../lib/duration'
import { activityWindowStart } from '../lib/timeline'
import type {
  BathEntry,
  DiaperEntry,
  FeedingEntry,
  GrowthEntry,
  MedicationEntry,
  SleepEntry,
} from '../types/models'

// Enough to cover a full day of entries since last night's start.
const RECENT_COUNT = 20
const DEFAULT_MEDICATION_NAME = 'Vitamin D'

/** Vitamin doses, whatever their exact name ("Vitamin D", Nara's "Vitamin/Probiotic"). */
function isVitamin(name: string): boolean {
  return name.trim().toLowerCase().startsWith('vitamin')
}

/** Rows for the entries at or after `windowStart` (the card only lists recent ones). */
function windowLines<T>(
  entries: T[],
  windowStart: Date,
  getIso: (entry: T) => string,
  summarize: (entry: T) => EntryRow,
  onSelect: (entry: T) => void,
  icon?: ReactNode,
): CategoryCardEntryRow[] {
  return entries
    .filter((entry) => new Date(getIso(entry)).getTime() >= windowStart.getTime())
    .map((entry) => ({ ...summarize(entry), icon, onClick: () => onSelect(entry) }))
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
  | { kind: 'medication'; entry?: MedicationEntry; name?: string }
  | { kind: 'bath'; entry?: BathEntry }
  | { kind: 'routine-menu' }
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
  const recentBath = useRecentBathEntries(household?.id ?? null, selectedBaby?.id ?? null, RECENT_COUNT)

  const growthEntries = useGrowthEntries(household?.id ?? null, selectedBaby?.id ?? null)

  if (!household || !selectedBaby || !user) return null

  const now = new Date()
  const nightStart = selectedBaby.nighttimeHours?.start ?? DEFAULT_NIGHTTIME_HOURS.start
  const windowStart = activityWindowStart(now, nightStart)
  const historyLabel = `Entries before ${nightStart}`

  const latestFeeding = recentFeeding[0]
  const feedingHighlight =
    latestFeeding?.type === 'bottle' && latestFeeding.volumeMl != null
      ? { value: String(latestFeeding.volumeMl), unit: 'mL' }
      : undefined
  const latestDiaper = recentDiaper[0]

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
  // A running sleep is always recent; a finished one counts when it ended in the window.
  const sleepLines = windowLines(
    recentSleep,
    windowStart,
    (entry) => entry.endedAt ?? now.toISOString(),
    (entry) => summarizeSleepRow(entry, now, maxSleepSeconds),
    handleSelectSleep,
  )

  const maxVolumeMl = Math.max(
    0,
    ...recentFeeding
      .filter((entry) => entry.type === 'bottle' && entry.volumeMl != null)
      .map((entry) => entry.volumeMl as number),
  )
  const feedingLines = windowLines(
    recentFeeding,
    windowStart,
    (entry) => entry.occurredAt,
    (entry) => summarizeFeedingRow(entry, maxVolumeMl, now),
    (entry) => setModal({ kind: 'feeding', entry }),
    <FeedIcon />,
  )

  const diaperLines = windowLines(
    recentDiaper,
    windowStart,
    (entry) => entry.occurredAt,
    (entry) => summarizeDiaperRow(entry, now),
    (entry) => setModal({ kind: 'diaper', entry }),
    <DiaperIcon />,
  )

  const lastBath = recentBath[0]
  const lastVitamin = recentMedication.find((entry) => isVitamin(entry.name))
  const routineRows: CategoryCardEntryRow[] = [
    {
      icon: <BathIcon />,
      title: 'Bath',
      subtitle: lastBath ? formatRelativeTime(new Date(lastBath.occurredAt), now) : 'Not yet',
      onClick: () => setModal({ kind: 'bath' }),
    },
    {
      icon: <VitaminIcon />,
      title: DEFAULT_MEDICATION_NAME,
      subtitle: lastVitamin ? formatRelativeTime(new Date(lastVitamin.givenAt), now) : 'Not yet',
      onClick: () => setModal({ kind: 'medication', name: DEFAULT_MEDICATION_NAME }),
    },
  ]
  // Baths and doses since last night, newest first, each opening its own form.
  const routineLines = [
    ...recentBath.map((entry) => ({
      at: entry.occurredAt,
      row: { ...summarizeBathRow(entry, now), icon: <BathIcon />, onClick: () => setModal({ kind: 'bath', entry }) },
    })),
    ...recentMedication.map((entry) => ({
      at: entry.givenAt,
      row: {
        ...summarizeMedicationRow(entry, now),
        icon: isVitamin(entry.name) ? <VitaminIcon /> : <MedicationIcon />,
        onClick: () => setModal({ kind: 'medication', entry }),
      },
    })),
  ]
    .filter(({ at }) => new Date(at).getTime() >= windowStart.getTime())
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map(({ row }) => row)

  const growthRows: CategoryCardEntryRow[] = (['weight', 'height', 'headCircumference'] as GrowthMetric[]).map(
    (metric) => {
      const field = GROWTH_METRIC_FIELD[metric]
      const entry = latestGrowthEntryWithField(growthEntries, field as 'weightG' | 'heightMm' | 'headCircumferenceMm')
      const value = entry ? (entry[field] as number | null) : null
      const RowIcon = GROWTH_METRIC_ICONS[metric]
      return {
        icon: <RowIcon />,
        title: GROWTH_METRIC_LABELS[metric],
        subtitle: entry ? formatDate(new Date(entry.measuredAt), { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        value: value != null ? formatGrowthValue(metric, value, unit) : undefined,
        onClick: () => navigate(`/growth/${metric}`),
      }
    },
  )

  return (
    <div className="activity-page">
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
          highlight={feedingHighlight}
          lines={feedingLines}
          onShowHistory={handleShowHistory}
          historyLabel={historyLabel}
        />
      )}
      {isVisible('diaper') && (
        <CategoryCard
          title="Diaper"
          colorVar="--category-diaper"
          addLabel="Add a diaper change"
          onAdd={() => setModal({ kind: 'diaper' })}
          icon={<DiaperIcon />}
          primary={latestDiaper ? summarizeDiaperPrimary(latestDiaper, now) : null}
          onSelectPrimary={latestDiaper ? () => setModal({ kind: 'diaper', entry: latestDiaper }) : undefined}
          emptyLabel="No entries"
          highlight={latestDiaper ? { value: DIAPER_SHORT_LABELS[latestDiaper.type] } : undefined}
          lines={diaperLines}
          onShowHistory={handleShowHistory}
          historyLabel={historyLabel}
        />
      )}
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
          lines={sleepLines}
          onShowHistory={handleShowHistory}
          historyLabel={historyLabel}
        />
      )}
      {isVisible('routine') && (
        <CategoryCard
          title="Routine"
          colorVar="--category-routine"
          addLabel="Add a routine entry"
          onAdd={() => setModal({ kind: 'routine-menu' })}
          icon={<RoutineIcon />}
          showPrimary={false}
          primary={null}
          emptyLabel="No entries"
          pinnedRows={routineRows}
          lines={routineLines}
          onShowHistory={handleShowHistory}
          historyLabel={historyLabel}
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
          pinnedRows={growthRows}
        />
      )}

      <button
        type="button"
        className="activity-edit-button"
        onClick={() => navigate(`/account/family/${selectedBaby.id}/activities`)}
      >
        Edit Activities
      </button>

      {modal?.kind === 'sleep-active' && <SleepTimerModal onClose={closeModal} />}
      {modal?.kind === 'sleep-edit' && <SleepEntryEditModal entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'feeding' && <FeedingForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'diaper' && <DiaperForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'medication' && (
        <MedicationForm entry={modal.entry} defaultName={modal.name} onClose={closeModal} />
      )}
      {modal?.kind === 'bath' && <BathForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'routine-menu' && (
        <div className="action-menu-overlay" onClick={closeModal}>
          <div
            className="action-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Add to Routine"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Add to Routine</h2>
            <button type="button" onClick={() => setModal({ kind: 'bath' })}>
              Bath
            </button>
            <button type="button" onClick={() => setModal({ kind: 'medication', name: DEFAULT_MEDICATION_NAME })}>
              {DEFAULT_MEDICATION_NAME}
            </button>
            <button type="button" onClick={() => setModal({ kind: 'medication', name: '' })}>
              Other medication
            </button>
            <button type="button" onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {modal?.kind === 'reminder' && (
        <ReminderSettingsModal medicationName={DEFAULT_MEDICATION_NAME} onClose={closeModal} />
      )}
      {modal?.kind === 'growth' && <GrowthForm entry={modal.entry} onClose={closeModal} />}
    </div>
  )
}
