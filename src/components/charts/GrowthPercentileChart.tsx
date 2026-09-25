import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { UnitSystem } from '../../hooks/useUnitPreference'
import { GRAMS_PER_POUND, MM_PER_INCH, type GrowthMetric } from '../../lib/growthMetrics'
import { referenceCurves, REFERENCE_PERCENTILES, type Sex } from '../../lib/growthPercentiles'

export interface GrowthChildPoint {
  id: string
  ageMonths: number
  value: number
}

interface GrowthPercentileChartProps {
  metric: GrowthMetric
  sex: Sex
  unit: UnitSystem
  childPoints: GrowthChildPoint[]
  selectedId?: string
  onSelectPoint: (id: string | undefined) => void
}

interface Pt {
  x: number
  y: number
}

const MARGIN = { top: 16, right: 44, bottom: 40, left: 52 }
const LABEL_GAP = 13
/** How far (px) from a point a tap still selects it — fingers are not precise. */
const HIT_RADIUS = 28

/** Babies under a year get a month-by-month first-year axis; older ones the full WHO 0-24 range. */
function ageAxis(childPoints: GrowthChildPoint[]): { max: number; ticks: number[] } {
  const oldest = Math.max(0, ...childPoints.map((point) => point.ageMonths))
  if (oldest <= 11) return { max: 11, ticks: Array.from({ length: 12 }, (_, month) => month) }
  return { max: 24, ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24] }
}

/** Internal units (g / mm) → the unit shown on the axis, with its suffix. */
function displayUnit(metric: GrowthMetric, unit: UnitSystem): { factor: number; suffix: string } {
  if (metric === 'weight') return unit === 'imperial' ? { factor: GRAMS_PER_POUND, suffix: 'lb' } : { factor: 1000, suffix: 'kg' }
  return unit === 'imperial' ? { factor: MM_PER_INCH, suffix: 'in' } : { factor: 10, suffix: 'cm' }
}

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const normalized = raw / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

/** Monotone cubic (Fritsch–Carlson) path, so the monthly WHO rows read as smooth curves without overshoot. */
function smoothPath(points: Pt[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n < 3) return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join('')
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) slopes.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x))
  const tangents = [slopes[0]]
  for (let i = 1; i < n - 1; i++) {
    tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2)
  }
  tangents.push(slopes[n - 2])
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const dx = (p1.x - p0.x) / 3
    d += `C${p0.x + dx},${p0.y + tangents[i] * dx} ${p1.x - dx},${p1.y - tangents[i + 1] * dx} ${p1.x},${p1.y}`
  }
  return d
}

/** Nudges the right-edge percentile labels apart so the tightly packed low curves stay readable. */
function spreadLabels(ys: number[]): number[] {
  const order = ys.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < order.length; i++) {
    if (order[i].y - order[i - 1].y < LABEL_GAP) order[i].y = order[i - 1].y + LABEL_GAP
  }
  const result = [...ys]
  order.forEach(({ y, index }) => {
    result[index] = y
  })
  return result
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(360)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      if (element.clientWidth > 0) setWidth(element.clientWidth)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

export function GrowthPercentileChart({
  metric,
  sex,
  unit,
  childPoints,
  selectedId,
  onSelectPoint,
}: GrowthPercentileChartProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const height = Math.round(Math.min(620, Math.max(380, width * 1.5)))

  const axis = ageAxis(childPoints)
  const { factor, suffix } = displayUnit(metric, unit)
  const curves = referenceCurves(metric, sex).filter((point) => point.ageMonths <= axis.max)

  const values = [
    ...curves.flatMap((point) => point.values),
    ...childPoints.filter((point) => point.ageMonths <= axis.max).map((point) => point.value),
  ].map((value) => value / factor)
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const step = niceStep(dataMax - dataMin, 9)
  const yMin = Math.max(0, Math.floor((dataMin - step / 2) / step) * step)
  const yMax = Math.ceil(dataMax / step) * step
  const yTicks: number[] = []
  for (let tick = yMin; tick <= yMax + step / 1000; tick += step) yTicks.push(Number(tick.toFixed(6)))
  const decimals = step < 1 ? 1 : 0

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const xOf = (ageMonths: number) => MARGIN.left + (ageMonths / axis.max) * plotWidth
  const yOf = (display: number) => MARGIN.top + (1 - (display - yMin) / (yMax - yMin)) * plotHeight

  const curvePaths = REFERENCE_PERCENTILES.map((_, index) =>
    curves.map((point) => ({ x: xOf(point.ageMonths), y: yOf(point.values[index] / factor) })),
  )
  const labelYs = spreadLabels(curvePaths.map((path) => path[path.length - 1]?.y ?? 0))

  const plotted = childPoints
    .filter((point) => point.ageMonths <= axis.max)
    .map((point) => ({ ...point, x: xOf(point.ageMonths), y: yOf(point.value / factor) }))
  const selected = plotted.find((point) => point.id === selectedId)

  /** A tap selects the nearest measurement within reach; a tap on empty chart clears the selection. */
  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    let best: (typeof plotted)[number] | undefined
    let bestDistance = HIT_RADIUS
    for (const point of plotted) {
      const distance = Math.hypot(point.x - x, point.y - y)
      if (distance <= bestDistance) {
        best = point
        bestDistance = distance
      }
    }
    onSelectPoint(best?.id)
  }

  return (
    <div ref={containerRef} className="viz-root growth-chart">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Growth chart with WHO percentile curves"
        onPointerUp={handlePointerUp}
      >
        {yTicks.map((tick, index) => (
          <text
            key={tick}
            className="growth-chart-tick"
            x={12}
            y={yOf(tick)}
            dominantBaseline="middle"
          >
            {tick.toFixed(decimals)}
            {index === yTicks.length - 1 ? ` ${suffix}` : ''}
          </text>
        ))}

        {axis.ticks.map((tick) => (
          <text key={tick} className="growth-chart-tick" x={xOf(tick)} y={height - 10} textAnchor="middle">
            {tick}
          </text>
        ))}
        <text className="growth-chart-tick" x={xOf(axis.max)} y={height - 32} textAnchor="middle">
          months
        </text>

        {curvePaths.map((path, index) => {
          const percentile = REFERENCE_PERCENTILES[index]
          const isMedian = percentile === 50
          const end = path[path.length - 1]
          return (
            <g key={percentile}>
              <path
                d={smoothPath(path)}
                fill="none"
                stroke="var(--reference-curve)"
                strokeWidth={isMedian ? 2.5 : 1.25}
              />
              {end && (
                <text className="growth-chart-percentile" x={end.x + 8} y={labelYs[index]} dominantBaseline="middle">
                  {percentile}%
                </text>
              )}
            </g>
          )
        })}

        <polyline
          points={plotted.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke="var(--growth-point)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {plotted.map((point) => (
          <circle key={point.id} cx={point.x} cy={point.y} r={7} fill="var(--growth-point)" />
        ))}
        {selected && (
          <circle
            cx={selected.x}
            cy={selected.y}
            r={17}
            fill="var(--surface)"
            stroke="var(--growth-point-selected)"
            strokeWidth={2.5}
          />
        )}
      </svg>
    </div>
  )
}
