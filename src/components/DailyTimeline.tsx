import { useHousehold } from '../contexts/HouseholdContext'
import { useTodayTimeline } from '../hooks/useTodayTimeline'
import { formatDuration } from '../lib/duration'
import type { TimelineEntry } from '../lib/timeline'

const DIAPER_LABELS: Record<string, string> = { pee: 'Pipi', poop: 'Caca', both: 'Pipi + caca' }

function describeEntry(item: TimelineEntry): string {
  const time = new Date(item.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  switch (item.kind) {
    case 'sleep': {
      const { durationSeconds } = item.entry
      return `${time} — Sommeil${durationSeconds != null ? ` (${formatDuration(durationSeconds)})` : ' (en cours)'}`
    }
    case 'feeding': {
      const label = item.entry.type === 'bottle' ? 'Biberon' : 'Solide'
      const detail =
        item.entry.type === 'bottle'
          ? item.entry.volumeMl != null
            ? ` ${item.entry.volumeMl} mL`
            : ''
          : item.entry.foodType
            ? ` (${item.entry.foodType})`
            : ''
      return `${time} — ${label}${detail}`
    }
    case 'diaper':
      return `${time} — Couche (${DIAPER_LABELS[item.entry.type]})`
  }
}

export function DailyTimeline() {
  const { household, selectedBaby } = useHousehold()
  const timeline = useTodayTimeline(household?.id ?? null, selectedBaby?.id ?? null)

  if (!household || !selectedBaby) return null

  return (
    <section aria-label="Journal du jour">
      <h2>Aujourd'hui</h2>
      {timeline.length === 0 ? (
        <p>Aucune entrée pour l'instant.</p>
      ) : (
        <ul>
          {timeline.map((item) => (
            <li key={`${item.kind}-${item.entry.id}`}>{describeEntry(item)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
