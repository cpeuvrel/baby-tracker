import { useMemo, useState } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import { dayKey, parseDayKey } from '../lib/timeline'
import { buildWeekBlocks, buildWeekMarks } from '../lib/weekTimeline'
import type { DateRange } from '../lib/timeline'

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const MIN_VISIBLE_BLOCK_MS = 60_000
const DAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

type EntryKind = 'sleep' | 'feeding' | 'diaper'

const KIND_OPTIONS: { kind: EntryKind; label: string; colorVar: string }[] = [
  { kind: 'sleep', label: 'Sommeil', colorVar: '--category-sleep' },
  { kind: 'feeding', label: 'Biberon', colorVar: '--category-feeding' },
  { kind: 'diaper', label: 'Couche', colorVar: '--category-diaper' },
]

function startOfWeek(reference: Date): Date {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  const isoWeekday = (start.getDay() + 6) % 7 // Monday = 0
  start.setDate(start.getDate() - isoWeekday)
  return start
}

function weekDayKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + i)
    return dayKey(day)
  })
}

interface WeekTimelineChartProps {
  onSelectDay: (date: Date) => void
  selectedDayKey: string
}

export function WeekTimelineChart({ onSelectDay, selectedDayKey }: WeekTimelineChartProps) {
  const { household, selectedBaby } = useHousehold()
  const [weekOffset, setWeekOffset] = useState(0)
  const [visibleKinds, setVisibleKinds] = useState<Set<EntryKind>>(
    () => new Set(['sleep', 'feeding', 'diaper']),
  )

  const weekStart = useMemo(() => {
    const start = startOfWeek(new Date())
    start.setDate(start.getDate() + weekOffset * 7)
    return start
  }, [weekOffset])
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 7)
    return end
  }, [weekStart])
  const dayKeys = useMemo(() => weekDayKeys(weekStart), [weekStart])
  const range: DateRange = useMemo(() => ({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const { feeding, sleep, diaper } = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    range,
  )

  const sleepBlocksByDay = useMemo(
    () =>
      buildWeekBlocks(
        dayKeys,
        sleep.map((entry) => {
          const start = new Date(entry.startedAt)
          const end = entry.endedAt
            ? new Date(entry.endedAt)
            : new Date(Math.max(Date.now(), start.getTime() + MIN_VISIBLE_BLOCK_MS))
          return { start, end }
        }),
      ),
    [dayKeys, sleep],
  )
  const feedMarksByDay = useMemo(
    () => buildWeekMarks(dayKeys, feeding.map((entry) => new Date(entry.occurredAt))),
    [dayKeys, feeding],
  )
  const diaperMarksByDay = useMemo(
    () => buildWeekMarks(dayKeys, diaper.map((entry) => new Date(entry.occurredAt))),
    [dayKeys, diaper],
  )

  if (!household || !selectedBaby) return null

  const toggleKind = (kind: EntryKind) => {
    setVisibleKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const monthLabel = weekStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const todayKey = dayKey(new Date())

  return (
    <section aria-label="Calendrier de la semaine" className="week-chart">
      <div className="week-chart-nav">
        <button type="button" aria-label="Semaine précédente" onClick={() => setWeekOffset((v) => v - 1)}>
          ‹
        </button>
        <span className="week-chart-month">{monthLabel}</span>
        <button type="button" aria-label="Semaine suivante" onClick={() => setWeekOffset((v) => v + 1)}>
          ›
        </button>
      </div>

      <div role="group" aria-label="Filtrer par type">
        {KIND_OPTIONS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={visibleKinds.has(kind)}
            onClick={() => toggleKind(kind)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="week-chart-grid">
        <div className="week-chart-axis">
          {HOUR_LABELS.map((hour) => (
            <span key={hour}>{String(hour).padStart(2, '0')}</span>
          ))}
        </div>
        {dayKeys.map((key, index) => {
          const date = parseDayKey(key)
          const isToday = key === todayKey
          const isSelected = key === selectedDayKey
          return (
            <div key={key} className="week-chart-day">
              <button
                type="button"
                className={`week-chart-day-header${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                onClick={() => onSelectDay(date)}
                aria-label={`Voir le détail du ${date.toLocaleDateString('fr-FR')}`}
              >
                <span>{DAY_LABELS[index]}</span>
                <span>{date.getDate()}</span>
              </button>
              <div className="week-chart-column">
                {HOUR_LABELS.slice(1, -1).map((hour) => (
                  <span key={hour} className="week-chart-gridline" style={{ top: `${(hour / 24) * 100}%` }} />
                ))}
                {visibleKinds.has('sleep') &&
                  sleepBlocksByDay[key]?.map((block, blockIndex) => (
                    <span
                      key={blockIndex}
                      className="week-chart-block"
                      style={{
                        top: `${block.startFraction * 100}%`,
                        height: `${(block.endFraction - block.startFraction) * 100}%`,
                        background: 'var(--category-sleep)',
                      }}
                    />
                  ))}
                {visibleKinds.has('feeding') &&
                  feedMarksByDay[key]?.map((mark, markIndex) => (
                    <span
                      key={markIndex}
                      className="week-chart-mark"
                      style={{ top: `${mark.atFraction * 100}%`, background: 'var(--category-feeding)' }}
                    />
                  ))}
                {visibleKinds.has('diaper') &&
                  diaperMarksByDay[key]?.map((mark, markIndex) => (
                    <span
                      key={markIndex}
                      className="week-chart-mark"
                      style={{ top: `${mark.atFraction * 100}%`, background: 'var(--category-diaper)' }}
                    />
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
