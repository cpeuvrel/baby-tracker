import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  GrowthPercentileChart,
  PROJECTION_ID,
  type GrowthChildPoint,
} from '../components/charts/GrowthPercentileChart'
import { GrowthForm } from '../components/GrowthForm'
import { LineChartIcon, MenuIcon } from '../components/icons'
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
import { percentileForValue, projectOnSamePercentile } from '../lib/growthPercentiles'
import type { GrowthEntry } from '../types/models'

const METRICS: GrowthMetric[] = ['weight', 'height', 'headCircumference']

/** Below about a week since the last measurement, a projection to today would sit on top of it. */
const MIN_PROJECTION_GAP_MONTHS = 7 / 30

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

  const selectedPoint = points.find((point) => point.id === selectedId)
  const percentileOf = (point: GrowthPoint) =>
    sex ? percentileForValue(metric, sex, point.ageMonths, point.value) : undefined
  const selectedPercentile = selectedPoint ? percentileOf(selectedPoint) : undefined
  const sexPercentileLabel = sex === 'female' ? 'Girls Percentile' : 'Boys Percentile'

  // Where the child would be today if they stayed on the last measurement's percentile.
  const lastPoint = points[points.length - 1]
  const todayAgeMonths = ageInMonths(selectedBaby.birthDate, new Date())
  const projectedValue =
    sex && lastPoint && todayAgeMonths - lastPoint.ageMonths >= MIN_PROJECTION_GAP_MONTHS
      ? projectOnSamePercentile(metric, sex, lastPoint, todayAgeMonths)
      : undefined
  const projection = projectedValue != null ? { ageMonths: todayAgeMonths, value: projectedValue } : undefined
  const isProjectionSelected = projection != null && selectedId === PROJECTION_ID

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
          className="detail-header-toggle"
          aria-label={view === 'chart' ? 'Show list' : 'Show chart'}
          onClick={() => {
            setSelectedId(undefined)
            setView((current) => (current === 'chart' ? 'list' : 'chart'))
          }}
        >
          {view === 'chart' ? <MenuIcon /> : <LineChartIcon />}
        </button>
      </div>

      <div role="group" aria-label="Metric" className="segmented-control growth-metric-tabs">
        {METRICS.map((m) => (
          <button key={m} type="button" aria-pressed={m === metric} onClick={() => {
              setSelectedId(undefined)
              navigate(`/growth/${m}`)
            }}
          >
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
        <div className="growth-chart-area">
          <GrowthPercentileChart
            metric={metric}
            sex={sex}
            childPoints={childPoints}
            projection={projection}
            unit={unit}
            selectedId={isProjectionSelected ? PROJECTION_ID : selectedPoint?.id}
            onSelectPoint={setSelectedId}
          />
          {isProjectionSelected && lastPoint && (
            <div className="growth-selection-card" role="region" aria-label="Projection">
              <div className="growth-selection-header">
                <span>Today · estimate</span>
                <button
                  type="button"
                  className="growth-selection-close"
                  aria-label="Close"
                  onClick={() => setSelectedId(undefined)}
                >
                  ×
                </button>
              </div>
              <p className="growth-entry-line">
                {GROWTH_METRIC_LABELS[metric]} <strong>≈ {formatGrowthValue(metric, projection.value, unit)}</strong>
              </p>
              {percentileOf(lastPoint) != null && (
                <p className="growth-entry-line">
                  {sexPercentileLabel} <strong>{Math.round(percentileOf(lastPoint) as number)}%</strong>
                </p>
              )}
              <p className="growth-selection-source">
                Not a measurement: same percentile as on {formatMeasuredDate(lastPoint.entry.measuredAt)}.
              </p>
            </div>
          )}
          {selectedPoint && (
            <div className="growth-selection-card" role="region" aria-label="Selected measurement">
              <div className="growth-selection-header">
                <span>{formatMeasuredDate(selectedPoint.entry.measuredAt)}</span>
                <span className="growth-selection-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="growth-selection-edit"
                  onClick={() => setEditingEntry(selectedPoint.entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="growth-selection-close"
                  aria-label="Close"
                  onClick={() => setSelectedId(undefined)}
                >
                  ×
                </button>
              </div>
              <p className="growth-entry-line">
                {GROWTH_METRIC_LABELS[metric]} <strong>{formatGrowthValue(metric, selectedPoint.value, unit)}</strong>
              </p>
              {selectedPercentile != null && (
                <p className="growth-entry-line">
                  {sexPercentileLabel} <strong>{Math.round(selectedPercentile)}%</strong>
                </p>
              )}
              <p className="growth-entry-line">
                Age <strong>{formatAge(selectedBaby.birthDate, new Date(selectedPoint.entry.measuredAt))}</strong>
              </p>
              <p className="growth-selection-source">Source: WHO</p>
            </div>
          )}
        </div>
      )}

      {view === 'list' &&
        (listEntries.length === 0 ? (
          <p className="detail-delta-caption">No measurements yet.</p>
        ) : (
          <ul className="detail-entries growth-entry-list">
            {listEntries.map((point, index) => {
              const dateLabel = formatMeasuredDate(point.entry.measuredAt)
              const previousDateLabel = index > 0 ? formatMeasuredDate(listEntries[index - 1].entry.measuredAt) : null
              const pointPercentile = percentileOf(point)
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
