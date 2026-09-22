import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Delta } from '../lib/aggregations'

interface TrendRowProps {
  to: string
  icon: ReactNode
  title: string
  subtitle: string
  delta: Delta
  deltaLabel: string
  colorVar: string
}

export function TrendRow({ to, icon, title, subtitle, delta, deltaLabel, colorVar }: TrendRowProps) {
  return (
    <Link to={to} className="trend-row">
      <span className="trend-row-icon" style={{ color: `var(${colorVar})` }}>
        {icon}
      </span>
      <span className="trend-row-text">
        <span className="trend-row-title">{title}</span>
        <span className="trend-row-subtitle">{subtitle}</span>
      </span>
      {delta.direction !== 'flat' && (
        <span className="trend-row-delta" style={{ background: `var(${colorVar})` }}>
          {delta.direction === 'up' ? '↑' : '↓'} {deltaLabel}
        </span>
      )}
    </Link>
  )
}
