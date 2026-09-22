import { useMemo, useState } from 'react'
import { DailyBarChart } from '../components/charts/DailyBarChart'
import { useHousehold } from '../contexts/HouseholdContext'
import { useEntriesInRange } from '../hooks/useEntriesInRange'
import {
  computeDiaperStats,
  computeFeedingStats,
  computeSleepStats,
  sumSecondsByDay,
  sumVolumeByDay,
} from '../lib/aggregations'
import { formatDuration } from '../lib/duration'
import { dayRange, lastNDayKeys, lastNDaysRange } from '../lib/timeline'
import { GrowthPage } from './GrowthPage'

const WEEK_DAYS = 7

type RangeMode = 'day' | 'week'

export function TrendsPage() {
  const { household, selectedBaby } = useHousehold()
  const [mode, setMode] = useState<RangeMode>('day')
  const now = useMemo(() => new Date(), [])
  const range = mode === 'day' ? dayRange(now) : lastNDaysRange(now, WEEK_DAYS)
  const dayCount = mode === 'day' ? 1 : WEEK_DAYS
  const { feeding, sleep, diaper } = useEntriesInRange(
    household?.id ?? null,
    selectedBaby?.id ?? null,
    range,
  )

  if (!household || !selectedBaby) return null

  const sleepStats = computeSleepStats(sleep, dayCount)
  const feedingStats = computeFeedingStats(feeding)
  const diaperStats = computeDiaperStats(diaper)
  const dayKeys = lastNDayKeys(now, WEEK_DAYS)
  const sleepByDay = sumSecondsByDay(dayKeys, sleep)
  const volumeByDay = sumVolumeByDay(dayKeys, feeding)

  return (
    <div>
      <div role="group" aria-label="Période">
        <button type="button" aria-pressed={mode === 'day'} onClick={() => setMode('day')}>
          Jour
        </button>
        <button type="button" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>
          Semaine
        </button>
      </div>

      <dl className="stat-grid">
        <div>
          <dt>Sommeil total</dt>
          <dd>{formatDuration(sleepStats.totalSeconds)}</dd>
        </div>
        <div>
          <dt>Sommeil moyen / jour</dt>
          <dd>{formatDuration(Math.round(sleepStats.averageSecondsPerDay))}</dd>
        </div>
        <div>
          <dt>Réveils nocturnes</dt>
          <dd>{sleepStats.nightWakings}</dd>
        </div>
        <div>
          <dt>Biberons</dt>
          <dd>{feedingStats.bottleCount}</dd>
        </div>
        <div>
          <dt>Volume total</dt>
          <dd>{feedingStats.totalVolumeMl > 0 ? `${feedingStats.totalVolumeMl} mL` : '—'}</dd>
        </div>
        <div>
          <dt>Volume moyen / biberon</dt>
          <dd>
            {feedingStats.averageVolumeMl != null ? `${Math.round(feedingStats.averageVolumeMl)} mL` : '—'}
          </dd>
        </div>
        <div>
          <dt>Couches pipi</dt>
          <dd>{diaperStats.pee}</dd>
        </div>
        <div>
          <dt>Couches caca</dt>
          <dd>{diaperStats.poop}</dd>
        </div>
        <div>
          <dt>Couches les deux</dt>
          <dd>{diaperStats.both}</dd>
        </div>
      </dl>

      <DailyBarChart
        title="Sommeil par jour (7 derniers jours)"
        data={sleepByDay}
        seriesColorVar="--series-1"
        formatValue={(value) => formatDuration(value)}
      />
      <DailyBarChart
        title="Biberons : volume par jour (7 derniers jours)"
        data={volumeByDay}
        seriesColorVar="--series-2"
        formatValue={(value) => `${value} mL`}
      />

      <GrowthPage />
    </div>
  )
}
