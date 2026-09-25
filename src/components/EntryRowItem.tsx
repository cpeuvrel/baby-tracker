import type { ReactNode } from 'react'
import { BlobIcon } from './BlobIcon'

export interface CategoryCardEntryRow {
  icon?: ReactNode
  title: string
  /** Second line under the title (e.g. a measurement's date); the value then moves to the right. */
  subtitle?: string
  value?: string
  barFraction?: number
  onClick: () => void
}

const MIN_BAR_FRACTION = 0.05
const BAR_MAX_WIDTH_PERCENT = 70

export function EntryRowItem({
  icon,
  title,
  subtitle,
  value,
  barFraction,
  onClick,
  colorVar,
}: CategoryCardEntryRow & { colorVar: string }) {
  const hasSubtitle = subtitle != null
  return (
    <li>
      <button
        type="button"
        className={`category-card-row${hasSubtitle ? ' category-card-row-measure' : ''}`}
        onClick={onClick}
      >
        {icon && (
          <BlobIcon colorVar={colorVar} size={hasSubtitle ? 'medium' : 'small'}>
            {icon}
          </BlobIcon>
        )}
        <span className="category-card-row-main">
          <span className="category-card-row-title">{title}</span>
          {hasSubtitle && <span className="category-card-row-subtitle">{subtitle}</span>}
          {!hasSubtitle && value != null && (
            <span className="category-card-row-meta">
              {barFraction != null && (
                <span
                  className="category-card-row-bar"
                  style={{
                    width: `${Math.max(MIN_BAR_FRACTION, Math.min(barFraction, 1)) * BAR_MAX_WIDTH_PERCENT}%`,
                    background: `var(${colorVar})`,
                  }}
                />
              )}
              <span className="category-card-row-value">{value}</span>
            </span>
          )}
        </span>
        {hasSubtitle && value != null && <span className="category-card-row-end-value">{value}</span>}
        <span className="category-card-row-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}
