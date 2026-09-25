import { ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { referenceCurves, REFERENCE_PERCENTILES, type Sex } from '../../lib/growthPercentiles'
import type { GrowthMetric } from '../../lib/growthMetrics'

export interface GrowthChildPoint {
  id: string
  ageMonths: number
  value: number
}

interface DotProps {
  cx?: number
  cy?: number
  index?: number
  payload?: GrowthChildPoint
}

interface EndLabelProps {
  x?: number | string
  y?: number | string
  index?: number
}

interface GrowthPercentileChartProps {
  metric: GrowthMetric
  sex: Sex
  childPoints: GrowthChildPoint[]
  selectedId?: string
  formatValue: (value: number) => string
  onSelectPoint: (id: string) => void
}

/** Babies under a year get a month-by-month first-year axis; older ones the full WHO 0-24 range. */
function ageAxis(childPoints: GrowthChildPoint[]): { max: number; ticks: number[] } {
  const oldest = Math.max(0, ...childPoints.map((point) => point.ageMonths))
  if (oldest <= 11) return { max: 11, ticks: Array.from({ length: 12 }, (_, month) => month) }
  return { max: 24, ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24] }
}

export function GrowthPercentileChart({
  metric,
  sex,
  childPoints,
  selectedId,
  formatValue,
  onSelectPoint,
}: GrowthPercentileChartProps) {
  const axis = ageAxis(childPoints)
  const referenceData = referenceCurves(metric, sex)
    .filter((point) => point.ageMonths <= axis.max)
    .map((point) => {
      const row: Record<string, number> = { ageMonths: point.ageMonths }
      REFERENCE_PERCENTILES.forEach((percentile, index) => {
        row[`p${percentile}`] = point.values[index]
      })
      return row
    })
  const lastIndex = referenceData.length - 1

  const renderEndLabel = (percentile: number) => {
    return ({ x, y, index }: EndLabelProps) => {
      if (index !== lastIndex || x == null || y == null) return <g />
      const numX = Number(x)
      const numY = Number(y)
      return (
        <text x={numX + 6} y={numY + 4} fill="var(--reference-curve)" fontSize={11}>
          {percentile}%
        </text>
      )
    }
  }

  const renderChildDot = ({ cx, cy, payload }: DotProps) => {
    if (cx == null || cy == null || !payload) return <g />
    const isSelected = payload.id === selectedId
    return (
      <circle
        key={payload.id}
        cx={cx}
        cy={cy}
        r={isSelected ? 10 : 5}
        fill={isSelected ? 'var(--surface)' : 'var(--category-growth)'}
        stroke="var(--category-growth)"
        strokeWidth={isSelected ? 2 : 0}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectPoint(payload.id)}
      />
    )
  }

  return (
    <div className="viz-root growth-chart">
      <ResponsiveContainer width="100%" height={480}>
        <ComposedChart data={referenceData} margin={{ top: 8, right: 36, left: 0, bottom: 8 }}>
          <XAxis
            type="number"
            dataKey="ageMonths"
            domain={[0, axis.max]}
            ticks={axis.ticks}
            interval={0}
            axisLine={false}
            height={40}
            tick={{ fill: 'var(--text-muted-chart)', fontSize: 12 }}
            tickLine={false}
            label={{ value: 'months', position: 'insideBottomRight', offset: 0, fill: 'var(--text-muted-chart)', fontSize: 12 }}
          />
          <YAxis
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted-chart)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={['auto', 'auto']}
            tickFormatter={formatValue}
          />
          {REFERENCE_PERCENTILES.map((percentile) => (
            <Line
              key={percentile}
              dataKey={`p${percentile}`}
              stroke="var(--reference-curve)"
              strokeWidth={percentile === 50 ? 2 : 1}
              strokeOpacity={percentile === 50 ? 1 : 0.6}
              dot={false}
              isAnimationActive={false}
              type="monotone"
              label={renderEndLabel(percentile)}
            />
          ))}
          <Line
            data={childPoints}
            dataKey="value"
            stroke="var(--category-growth)"
            strokeWidth={2}
            dot={renderChildDot}
            isAnimationActive={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
