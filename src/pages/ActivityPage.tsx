import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionMenu } from '../components/ActionMenu'
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
import { LiveUpdatesAlert } from '../components/LiveUpdatesAlert'
import { MedicationForm } from '../components/MedicationForm'
import { ReminderSettingsModal } from '../components/ReminderSettingsModal'
import { SleepEntryEditModal } from '../components/SleepEntryEditModal'
import { SleepTimerModal } from '../components/SleepTimerModal'
import { TodayRecap } from '../components/TodayRecap'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActivityVisibility } from '../hooks/useActivityVisibility'
import { useActiveSleepEntriesState } from '../hooks/useActiveSleepEntry'
import { useEntriesInRangeState } from '../hooks/useEntriesInRange'
import { useGrowthEntriesState } from '../hooks/useGrowthEntries'
import { useNow } from '../hooks/useNow'
import { useRecentBathEntriesState } from '../hooks/useRecentBathEntries'
import { useRecentDiaperEntriesState } from '../hooks/useRecentDiaperEntries'
import { useRecentFeedingEntriesState } from '../hooks/useRecentFeedingEntries'
import { useRecentSleepEntriesState } from '../hooks/useRecentSleepEntries'
import { useSleepTimerBabyParam } from '../hooks/useSleepTimerNotification'
import { useUnitPreference } from '../hooks/useUnitPreference'
import {
  latestGrowthEntryWithField,
  DIAPER_SHORT_LABELS,
  sleepDurationSeconds,
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
import { addDays, formatDate } from '../lib/appTime'
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
import type { HistoryLocationState } from './HistoryPage'

const DEFAULT_MEDICATION_NAME = 'Vitamin D'
/** The cards list entries from a window start onwards: no entry is later than this. */
const FAR_FUTURE = new Date(Date.UTC(9999, 0, 1))

/** Vitamin doses, whatever their exact name ("Vitamin D", Nara's "Vitamin/Probiotic"). */
function isVitamin(name: string): boolean {
  return name.trim().toLowerCase().startsWith('vitamin')
}

/** The entries at or after `windowStart` (the cards only list recent ones). */
function inWindow<T>(entries: T[], windowStart: Date, getIso: (entry: T) => string): T[] {
  return entries.filter((entry) => new Date(getIso(entry)).getTime() >= windowStart.getTime())
}

/** A card row per entry, keyed by the entry's id. */
function entryLines<T extends { id: string }>(
  entries: T[],
  summarize: (entry: T) => EntryRow,
  onSelect: (entry: T) => void,
  icon?: ReactNode,
): CategoryCardEntryRow[] {
  return entries.map((entry) => ({ ...summarize(entry), id: entry.id, icon, onClick: () => onSelect(entry) }))
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
  // "?timer=sleep" (the sleep timer notification, the timer banner) opens the running timer.
  const [searchParams, setSearchParams] = useSearchParams()
  const sleepTimerRequested = searchParams.get('timer') === 'sleep'
  useSleepTimerBabyParam()
  const [unit] = useUnitPreference()
  const { isVisible } = useActivityVisibility()
  // Keeps "… ago" labels and the recent-entries window current without a reload.
  const now = useNow()

  const householdId = household?.id ?? null
  const babyId = selectedBaby?.id ?? null
  const nightStart = selectedBaby?.nighttimeHours?.start ?? DEFAULT_NIGHTTIME_HOURS.start
  // Since last night's start (yesterday 20:00 by default): stable for the whole day.
  const windowStart = activityWindowStart(now, nightStart)
  // Every entry since a day before the window, not just the latest few: a busy day never loses
  // its oldest rows. The extra day catches a sleep that started before the window and ended in
  // it, and yesterday's vitamin dose.
  const recent = useEntriesInRangeState(householdId, babyId, { start: addDays(windowStart, -1), end: FAR_FUTURE })
  // The latest entry of each kind, however old, for the cards' headline.
  const latestFeedingState = useRecentFeedingEntriesState(householdId, babyId, 1)
  const latestDiaperState = useRecentDiaperEntriesState(householdId, babyId, 1)
  const latestSleepState = useRecentSleepEntriesState(householdId, babyId, 1)
  const latestBathState = useRecentBathEntriesState(householdId, babyId, 1)
  const activeSleepState = useActiveSleepEntriesState(householdId, babyId)
  const growthState = useGrowthEntriesState(householdId, babyId)

  const states = [recent, latestFeedingState, latestDiaperState, latestSleepState, latestBathState, activeSleepState, growthState]
  const loading = states.some((state) => state.loading)
  const error = states.find((state) => state.error)?.error ?? null

  if (!household || !selectedBaby || !user) return null

  const historyLabel = `Entries before ${nightStart}`
  const activeSleepEntry = activeSleepState.entries[0] ?? null
  const growthEntries = growthState.entries

  const latestFeeding = latestFeedingState.entries[0]
  const feedingHighlight =
    latestFeeding?.type === 'bottle' && latestFeeding.volumeMl != null
      ? { value: String(latestFeeding.volumeMl), unit: 'mL' }
      : undefined
  const latestDiaper = latestDiaperState.entries[0]
  const latestSleep = latestSleepState.entries[0]

  const handleAddSleep = () => {
    setModal({ kind: 'sleep-active' })
  }

  const handleSelectSleep = (entry: SleepEntry) => {
    setModal(entry.endedAt === null ? { kind: 'sleep-active' } : { kind: 'sleep-edit', entry })
  }

  const closeModal = () => {
    setModal(null)
    if (sleepTimerRequested) setSearchParams({}, { replace: true })
  }

  // Opens yesterday's list, where the entries before the window are.
  const handleShowHistory = () =>
    navigate('/history', { state: { view: 'data', date: windowStart.toISOString() } satisfies HistoryLocationState })

  // A running sleep is always recent (even one started before the loaded range); a finished one
  // counts when it ended in the window.
  const runningOutsideRange = activeSleepState.entries.filter(
    (active) => !recent.sleep.some((entry) => entry.id === active.id),
  )
  const windowSleeps = inWindow([...recent.sleep, ...runningOutsideRange], windowStart, (entry) =>
    entry.endedAt ?? now.toISOString(),
  )
  const maxSleepSeconds = Math.max(0, ...windowSleeps.map(sleepDurationSeconds))
  const sleepLines = entryLines(
    windowSleeps,
    (entry) => summarizeSleepRow(entry, now, maxSleepSeconds),
    handleSelectSleep,
  )

  const windowFeedings = inWindow(recent.feeding, windowStart, (entry) => entry.occurredAt)
  const maxVolumeMl = Math.max(
    0,
    ...windowFeedings
      .filter((entry) => entry.type === 'bottle' && entry.volumeMl != null)
      .map((entry) => entry.volumeMl as number),
  )
  const feedingLines = entryLines(
    windowFeedings,
    (entry) => summarizeFeedingRow(entry, maxVolumeMl, now),
    (entry) => setModal({ kind: 'feeding', entry }),
    <FeedIcon />,
  )

  const diaperLines = entryLines(
    inWindow(recent.diaper, windowStart, (entry) => entry.occurredAt),
    (entry) => summarizeDiaperRow(entry, now),
    (entry) => setModal({ kind: 'diaper', entry }),
    <DiaperIcon />,
  )

  const lastBath = latestBathState.entries[0]
  // Latest first: the newest vitamin dose of the loaded range (since the day before last night).
  const lastVitamin = recent.medication.find((entry) => isVitamin(entry.name))
  const routineRows: CategoryCardEntryRow[] = [
    {
      id: 'bath',
      icon: <BathIcon />,
      title: 'Bath',
      subtitle: lastBath
        ? formatRelativeTime(new Date(lastBath.occurredAt), now)
        : loading
          ? 'Loading…'
          : 'Not yet',
      onClick: () => setModal({ kind: 'bath' }),
    },
    {
      id: 'vitamin',
      icon: <VitaminIcon />,
      title: DEFAULT_MEDICATION_NAME,
      subtitle: lastVitamin
        ? formatRelativeTime(new Date(lastVitamin.givenAt), now)
        : loading
          ? 'Loading…'
          : 'Not yet',
      onClick: () => setModal({ kind: 'medication', name: DEFAULT_MEDICATION_NAME }),
    },
  ]
  // Baths and doses since last night, newest first, each opening its own form.
  const routineLines = [
    ...recent.bath.map((entry) => ({
      at: entry.occurredAt,
      row: {
        ...summarizeBathRow(entry, now),
        id: entry.id,
        icon: <BathIcon />,
        onClick: () => setModal({ kind: 'bath', entry }),
      },
    })),
    ...recent.medication.map((entry) => ({
      at: entry.givenAt,
      row: {
        ...summarizeMedicationRow(entry, now),
        id: entry.id,
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
        id: metric,
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
      {error && <LiveUpdatesAlert />}
      <TodayRecap now={now} errorShownAbove={error != null} />
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
          loading={loading}
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
          loading={loading}
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
          primary={latestSleep ? summarizeSleepPrimary(latestSleep, now) : null}
          onSelectPrimary={latestSleep ? () => handleSelectSleep(latestSleep) : undefined}
          emptyLabel="No entries"
          loading={loading}
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
          loading={loading}
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

      {(modal?.kind === 'sleep-active' || sleepTimerRequested) && <SleepTimerModal onClose={closeModal} />}
      {modal?.kind === 'sleep-edit' && (
        <SleepEntryEditModal
          entry={modal.entry}
          onClose={closeModal}
          onResumed={() => setModal({ kind: 'sleep-active' })}
        />
      )}
      {modal?.kind === 'feeding' && <FeedingForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'diaper' && <DiaperForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'medication' && (
        <MedicationForm entry={modal.entry} defaultName={modal.name} onClose={closeModal} />
      )}
      {modal?.kind === 'bath' && <BathForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'routine-menu' && (
        <ActionMenu title="Add to Routine" onClose={closeModal}>
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
        </ActionMenu>
      )}
      {modal?.kind === 'reminder' && (
        <ReminderSettingsModal medicationName={DEFAULT_MEDICATION_NAME} onClose={closeModal} />
      )}
      {modal?.kind === 'growth' && <GrowthForm entry={modal.entry} onClose={closeModal} />}
    </div>
  )
}
