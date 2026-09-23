import { useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useDayTimeline } from '../hooks/useDayTimeline'
import { computeFeedingStats, computeSleepStats } from '../lib/aggregations'
import { formatDuration } from '../lib/duration'
import {
  summarizeDiaperRow,
  summarizeFeedingRow,
  summarizeMedicationRow,
  summarizeSleepRow,
} from '../lib/entrySummary'
import { KIND_OPTIONS, type EntryKind } from '../lib/historyFilters'
import type { TimelineEntry } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { DiaperForm } from './DiaperForm'
import { EntryRowItem, type CategoryCardEntryRow } from './EntryRowItem'
import { FeedingForm } from './FeedingForm'
import { DiaperIcon, FeedIcon, MedicationIcon, SleepIcon } from './icons'
import { MedicationForm } from './MedicationForm'
import { SleepEntryEditModal } from './SleepEntryEditModal'
import { SleepTimerModal } from './SleepTimerModal'

const KIND_COLOR_VAR: Record<EntryKind, string> = Object.fromEntries(
  KIND_OPTIONS.map((option) => [option.kind, option.colorVar]),
) as Record<EntryKind, string>

const KIND_ICON: Record<EntryKind, ReturnType<typeof SleepIcon>> = {
  sleep: <SleepIcon />,
  feeding: <FeedIcon />,
  diaper: <DiaperIcon />,
  medication: <MedicationIcon />,
}

type ModalState =
  | { kind: 'sleep-active' }
  | { kind: 'sleep-edit'; entry: SleepEntry }
  | { kind: 'feeding'; entry: FeedingEntry }
  | { kind: 'diaper'; entry: DiaperEntry }
  | { kind: 'medication'; entry: MedicationEntry }
  | null

interface DailyTimelineProps {
  date?: Date
  title?: string
  visibleKinds?: Set<EntryKind>
}

export function DailyTimeline({ date, title = 'Today', visibleKinds }: DailyTimelineProps) {
  const { household, selectedBaby } = useHousehold()
  const referenceDate = date ?? new Date()
  const fullTimeline = useDayTimeline(household?.id ?? null, selectedBaby?.id ?? null, referenceDate)
  const [modal, setModal] = useState<ModalState>(null)

  if (!household || !selectedBaby) return null

  const timeline = visibleKinds ? fullTimeline.filter((item) => visibleKinds.has(item.kind)) : fullTimeline
  const sleepEntries = fullTimeline
    .filter((item): item is Extract<TimelineEntry, { kind: 'sleep' }> => item.kind === 'sleep')
    .map((item) => item.entry)
  const feedingEntries = fullTimeline
    .filter((item): item is Extract<TimelineEntry, { kind: 'feeding' }> => item.kind === 'feeding')
    .map((item) => item.entry)
  const feedingStats = computeFeedingStats(feedingEntries)
  const sleepStats = computeSleepStats(sleepEntries, 1)

  const maxSleepSeconds = Math.max(
    0,
    ...sleepEntries.filter((entry) => entry.durationSeconds != null).map((entry) => entry.durationSeconds as number),
  )
  const maxVolumeMl = Math.max(
    0,
    ...feedingEntries
      .filter((entry) => entry.type === 'bottle' && entry.volumeMl != null)
      .map((entry) => entry.volumeMl as number),
  )

  const closeModal = () => setModal(null)

  const handleSelectSleep = (entry: SleepEntry) => {
    setModal(entry.endedAt === null ? { kind: 'sleep-active' } : { kind: 'sleep-edit', entry })
  }

  const rows: CategoryCardEntryRow[] = timeline.map((item) => {
    switch (item.kind) {
      case 'sleep':
        return {
          ...summarizeSleepRow(item.entry, referenceDate, maxSleepSeconds),
          icon: KIND_ICON.sleep,
          onClick: () => handleSelectSleep(item.entry),
        }
      case 'feeding':
        return {
          ...summarizeFeedingRow(item.entry, maxVolumeMl),
          icon: KIND_ICON.feeding,
          onClick: () => setModal({ kind: 'feeding', entry: item.entry }),
        }
      case 'diaper':
        return {
          ...summarizeDiaperRow(item.entry),
          icon: KIND_ICON.diaper,
          onClick: () => setModal({ kind: 'diaper', entry: item.entry }),
        }
      case 'medication':
        return {
          ...summarizeMedicationRow(item.entry),
          icon: KIND_ICON.medication,
          onClick: () => setModal({ kind: 'medication', entry: item.entry }),
        }
    }
  })

  return (
    <section aria-label="Daily log">
      <div className="history-summary-cards">
        <div className="history-summary-card">
          <span className="history-summary-card-icon" style={{ color: 'var(--category-feeding)' }}>
            <FeedIcon />
          </span>
          <div>
            <p className="history-summary-card-title">
              Bottle Feed <span className="history-summary-card-badge">{feedingStats.bottleCount}</span>
            </p>
            <p className="history-summary-card-line">{feedingStats.totalVolumeMl} mL total</p>
          </div>
        </div>
        <div className="history-summary-card">
          <span className="history-summary-card-icon" style={{ color: 'var(--category-sleep)' }}>
            <SleepIcon />
          </span>
          <div>
            <p className="history-summary-card-title">
              Sleep <span className="history-summary-card-badge">{sleepEntries.length}</span>
            </p>
            <p className="history-summary-card-line">{formatDuration(sleepStats.totalSeconds)} total sleep</p>
          </div>
        </div>
      </div>

      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        <ul>
          {timeline.map((item, index) => (
            <EntryRowItem
              key={`${item.kind}-${item.entry.id}`}
              {...rows[index]}
              colorVar={KIND_COLOR_VAR[item.kind]}
            />
          ))}
        </ul>
      )}

      {modal?.kind === 'sleep-active' && <SleepTimerModal onClose={closeModal} />}
      {modal?.kind === 'sleep-edit' && <SleepEntryEditModal entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'feeding' && <FeedingForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'diaper' && <DiaperForm entry={modal.entry} onClose={closeModal} />}
      {modal?.kind === 'medication' && <MedicationForm entry={modal.entry} onClose={closeModal} />}
    </section>
  )
}
