import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyPoint } from '../../lib/aggregations'
import { parseDayKey } from '../../lib/timeline'

interface DailyBarChartProps {
  title: string
  data: DailyPoint[]
  seriesColorVar: '--series-1' | '--series-2'
  formatValue: (value: number) => string
}

function formatDay(key: string): string {
  return parseDayKey(key).toLocaleDateString('en-US', { weekday: 'short' })
}

export function DailyBarChart({ title, data, seriesColorVar, formatValue }: DailyBarChartProps) {
  return (
    <div className="viz-root">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="dayKey"
            tickFormatter={formatDay}
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
            width={52}
          />
          <Tooltip
            cursor={{ fill: 'var(--gridline)' }}
            contentStyle={{
              background: 'var(--surface-1)',
              border: '1px solid var(--gridline)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
            labelFormatter={(label) => formatDay(String(label))}
            formatter={(value) => formatValue(Number(value))}
          />
          <Bar dataKey="value" fill={`var(${seriesColorVar})`} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
