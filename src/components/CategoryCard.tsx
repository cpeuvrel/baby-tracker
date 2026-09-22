import { useState, type ReactNode } from 'react'

export interface CategoryCardEntryRow {
  icon?: ReactNode
  title: string
  value?: string
  barFraction?: number
  onClick: () => void
}

interface CategoryCardProps {
  title: string
  colorVar: string
  addLabel: string
  onAdd: () => void
  addIcon?: ReactNode
  addActive?: boolean
  icon: ReactNode
  showPrimary?: boolean
  primary: { label: string; meta: string } | null
  onSelectPrimary?: () => void
  emptyLabel: string
  todayLines?: CategoryCardEntryRow[]
  moreLines: CategoryCardEntryRow[]
  secondaryAction?: { label: string; onClick: () => void }
  highlight?: { value: string; unit: string }
}

function EntryRowItem({ icon, title, value, barFraction, onClick, colorVar }: CategoryCardEntryRow & { colorVar: string }) {
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

export function CategoryCard({
  title,
  colorVar,
  addLabel,
  onAdd,
  addIcon,
  addActive,
  icon,
  showPrimary = true,
  primary,
  onSelectPrimary,
  emptyLabel,
  todayLines = [],
  moreLines,
  secondaryAction,
  highlight,
}: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false)

  const primaryText = primary ? (
    <div className="category-card-primary-text">
      <p className="category-card-label">{primary.label}</p>
      <p className="category-card-meta">{primary.meta}</p>
    </div>
  ) : (
    <div className="category-card-primary-text">
      <p className="category-card-label">{emptyLabel}</p>
    </div>
  )

  return (
    <section className="category-card" aria-label={title}>
      <header style={{ background: `var(${colorVar})` }}>
        <h3>{title}</h3>
        <button
          type="button"
          aria-label={addLabel}
          className={`add-button${addActive ? ' add-button-active' : ''}`}
          onClick={onAdd}
        >
          {addIcon ?? '+'}
        </button>
      </header>
      <div className="category-card-body">
        {showPrimary && (
          <div className="category-card-primary">
            <span className="category-card-icon" style={{ color: `var(${colorVar})` }}>
              {icon}
            </span>
            {primary && onSelectPrimary ? (
              <button type="button" className="category-card-primary-button" onClick={onSelectPrimary}>
                {primaryText}
              </button>
            ) : (
              primaryText
            )}
            {highlight && primary && (
              <p className="category-card-highlight">
                {highlight.value}
                <span>{highlight.unit}</span>
              </p>
            )}
          </div>
        )}
        {secondaryAction && (
          <button type="button" className="link-button" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </button>
        )}
        {todayLines.length > 0 && (
          <ul>
            {todayLines.map((row, index) => (
              <EntryRowItem key={index} {...row} colorVar={colorVar} />
            ))}
          </ul>
        )}
        {moreLines.length > 0 && (
          <>
            <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Réduire' : 'Voir plus'}
            </button>
            {expanded && (
              <ul>
                {moreLines.map((row, index) => (
                  <EntryRowItem key={index} {...row} colorVar={colorVar} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}
