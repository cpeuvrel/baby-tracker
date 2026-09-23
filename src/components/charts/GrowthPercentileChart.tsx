import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'
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

export function GrowthPercentileChart({
  metric,
  sex,
  childPoints,
  selectedId,
  formatValue,
  onSelectPoint,
}: GrowthPercentileChartProps) {
  const referenceData = referenceCurves(metric, sex).map((point) => {
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
        r={isSelected ? 7 : 4}
        fill={isSelected ? 'var(--surface)' : 'var(--category-growth)'}
        stroke="var(--category-growth)"
        strokeWidth={isSelected ? 2 : 0}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectPoint(payload.id)}
      />
    )
  }

  return (
    <div className="viz-root">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={referenceData} margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            type="number"
            dataKey="ageMonths"
            domain={[0, 24]}
            ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted-chart)', fontSize: 12 }}
            tickLine={false}
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
