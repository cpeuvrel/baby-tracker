import { useState } from 'react'
import { DailyTimeline } from '../components/DailyTimeline'
import { WeekTimelineChart } from '../components/WeekTimelineChart'
import { dayKey } from '../lib/timeline'

function formatDayTitle(date: Date): string {
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function HistoryPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  return (
    <div>
      <WeekTimelineChart onSelectDay={setSelectedDate} selectedDayKey={dayKey(selectedDate)} />
      <DailyTimeline date={selectedDate} title={formatDayTitle(selectedDate)} />
    </div>
  )
}
