import type { ReactNode } from 'react'

export interface CategoryCardEntryRow {
  icon?: ReactNode
  title: string
  value?: string
  barFraction?: number
  onClick: () => void
}

export function EntryRowItem({
  icon,
  title,
  value,
  barFraction,
  onClick,
  colorVar,
}: CategoryCardEntryRow & { colorVar: string }) {
  return (
    <li>
      <button type="button" className="category-card-row" onClick={onClick}>
        {icon && (
          <span className="category-card-row-icon" style={{ color: `var(${colorVar})` }}>
            {icon}
          </span>
        )}
        <span className="category-card-row-title">{title}</span>
        {value != null && (
          <span className="category-card-row-meta">
            {barFraction != null && (
              <span className="category-card-row-bar-track">
                <span
                  className="category-card-row-bar-fill"
                  style={{ width: `${Math.min(barFraction, 1) * 100}%`, background: `var(${colorVar})` }}
                />
              </span>
            )}
            <span className="category-card-row-value">{value}</span>
          </span>
        )}
        <span className="category-card-row-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}
