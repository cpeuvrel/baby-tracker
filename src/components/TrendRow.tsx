import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Delta } from '../lib/aggregations'

export interface TrendRowBreakdownItem {
  label: string
  colorVar: string
  value: string
}

interface TrendRowProps {
  to: string
  icon: ReactNode
  title: string
  subtitle: string
  delta: Delta
  deltaLabel: string
  colorVar: string
  /** Per-type split listed under the subtitle ("Bottle Feed 3.5"). */
  breakdown?: TrendRowBreakdownItem[]
}

export function TrendRow({ to, icon, title, subtitle, delta, deltaLabel, colorVar, breakdown = [] }: TrendRowProps) {
  return (
    <Link to={to} className="trend-row">
      <span className="trend-row-icon">{icon}</span>
      <span className="trend-row-title">{title}</span>
      <span className="trend-row-chevron" aria-hidden="true">
        ›
      </span>
      <span className="trend-row-subtitle">{subtitle}</span>
      {delta.direction !== 'flat' && (
        <span className="trend-row-delta" style={{ background: `var(${colorVar})` }}>
          {delta.direction === 'up' ? '↑' : '↓'} {deltaLabel}
        </span>
      )}
      {breakdown.length > 0 && (
        <span className="trend-row-breakdown">
          {breakdown.map((item) => (
            <span key={item.label} className="trend-row-breakdown-item">
              <span className="trend-row-breakdown-swatch" style={{ background: `var(${item.colorVar})` }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </span>
          ))}
        </span>
      )}
    </Link>
  )
}
