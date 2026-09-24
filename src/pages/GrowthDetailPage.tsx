import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GrowthPercentileChart, type GrowthChildPoint } from '../components/charts/GrowthPercentileChart'
import { GrowthForm } from '../components/GrowthForm'
import { GrowthIcon, ListViewIcon } from '../components/icons'
import { useHousehold } from '../contexts/HouseholdContext'
import { useGrowthEntries } from '../hooks/useGrowthEntries'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { formatDate } from '../lib/appTime'
import { ageInMonths, formatAge } from '../lib/age'
import {
  formatGrowthValue,
  GROWTH_METRIC_FIELD,
  GROWTH_METRIC_LABELS,
  type GrowthMetric,
} from '../lib/growthMetrics'
import { percentileForValue } from '../lib/growthPercentiles'
import type { GrowthEntry } from '../types/models'

const METRICS: GrowthMetric[] = ['weight', 'height', 'headCircumference']

type ViewMode = 'chart' | 'list'

interface GrowthPoint {
  entry: GrowthEntry
  id: string
  ageMonths: number
  value: number
}

function isGrowthMetric(value: string | undefined): value is GrowthMetric {
  return value === 'weight' || value === 'height' || value === 'headCircumference'
}

function formatMeasuredDate(iso: string): string {
  return formatDate(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' })
}

export function GrowthDetailPage() {
  const { metric: metricParam } = useParams<{ metric: string }>()
  const navigate = useNavigate()
  const { household, selectedBaby } = useHousehold()
  const growthEntries = useGrowthEntries(household?.id ?? null, selectedBaby?.id ?? null)
  const [unit] = useUnitPreference()
  const [view, setView] = useState<ViewMode>('chart')
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [editingEntry, setEditingEntry] = useState<GrowthEntry | undefined>()

  if (!household || !selectedBaby || !isGrowthMetric(metricParam)) return null

  const metric = metricParam
  const field = GROWTH_METRIC_FIELD[metric]
  const sex = selectedBaby.sex

  const points: GrowthPoint[] = growthEntries
    .filter((entry) => entry[field] != null)
    .map((entry) => ({
      entry,
      id: entry.id,
      ageMonths: ageInMonths(selectedBaby.birthDate, new Date(entry.measuredAt)),
      value: entry[field] as number,
    }))
    .sort((a, b) => a.ageMonths - b.ageMonths)

  const activeId = selectedId ?? points[points.length - 1]?.id
  const sexPercentileLabel = sex === 'female' ? 'Girls Percentile' : 'Boys Percentile'

  const childPoints: GrowthChildPoint[] = points.map((point) => ({
    id: point.id,
    ageMonths: point.ageMonths,
    value: point.value,
  }))

  const listEntries = [...points].reverse()

  return (
    <div>
      <div className="detail-header">
        <button type="button" aria-label="Back" onClick={() => navigate('/')}>
          ‹
        </button>
        <h2>Growth</h2>
        <button
          type="button"
          aria-label={view === 'chart' ? 'Show list' : 'Show chart'}
          onClick={() => setView((current) => (current === 'chart' ? 'list' : 'chart'))}
        >
          {view === 'chart' ? <ListViewIcon /> : <GrowthIcon />}
        </button>
      </div>

      <div role="group" aria-label="Metric">
        {METRICS.map((m) => (
          <button key={m} type="button" aria-pressed={m === metric} onClick={() => navigate(`/growth/${m}`)}>
            {GROWTH_METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {!sex && (
        <p className="detail-delta-caption">
          Set the baby&apos;s sex in Settings to see WHO percentile curves.
        </p>
      )}

      {view === 'chart' && sex && (
        <GrowthPercentileChart
          metric={metric}
          sex={sex}
          childPoints={childPoints}
          selectedId={activeId}
          formatValue={(value) => formatGrowthValue(metric, value, unit)}
          onSelectPoint={(id) => setSelectedId(id)}
        />
      )}

      {view === 'list' &&
        (listEntries.length === 0 ? (
          <p className="detail-delta-caption">No measurements yet.</p>
        ) : (
          <ul className="detail-entries growth-entry-list">
            {listEntries.map((point, index) => {
              const dateLabel = formatMeasuredDate(point.entry.measuredAt)
              const previousDateLabel = index > 0 ? formatMeasuredDate(listEntries[index - 1].entry.measuredAt) : null
              const pointPercentile = sex
                ? percentileForValue(metric, sex, point.ageMonths, point.value)
                : undefined
              return (
                <li key={point.id} className="growth-entry-item">
                  {dateLabel !== previousDateLabel && <p className="growth-entry-date">{dateLabel}</p>}
                  <button type="button" className="growth-entry-row" onClick={() => setEditingEntry(point.entry)}>
                    <p className="growth-entry-line">
                      {GROWTH_METRIC_LABELS[metric]}{' '}
                      <strong>{formatGrowthValue(metric, point.value, unit)}</strong>
                    </p>
                    <p className="growth-entry-line growth-entry-line-chevron">
                      <span>
                        {sexPercentileLabel}
                        {pointPercentile != null && (
                          <>
                            {' '}
                            <strong>{Math.round(pointPercentile)}%</strong>
                          </>
                        )}
                      </span>
                      <span className="list-row-chevron" aria-hidden="true">
                        ›
                      </span>
                    </p>
                    <p className="growth-entry-line">
                      Age <strong>{formatAge(selectedBaby.birthDate, new Date(point.entry.measuredAt))}</strong>
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        ))}

      {editingEntry && <GrowthForm entry={editingEntry} onClose={() => setEditingEntry(undefined)} />}
    </div>
  )
}
