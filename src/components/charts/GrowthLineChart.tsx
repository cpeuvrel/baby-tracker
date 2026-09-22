import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface GrowthPoint {
  measuredAt: string
  value: number
}

interface GrowthLineChartProps {
  data: GrowthPoint[]
  formatValue: (value: number) => string
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function GrowthLineChart({ data, formatValue }: GrowthLineChartProps) {
  return (
    <div className="viz-root">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="measuredAt"
            tickFormatter={formatDate}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted-chart)', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatValue}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted-chart)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-1)',
              border: '1px solid var(--gridline)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
            labelFormatter={(value) => formatDate(String(value))}
            formatter={(value) => formatValue(Number(value))}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--series-1)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
