import type { ReactNode } from 'react'
import { EntryRowItem, type CategoryCardEntryRow } from './EntryRowItem'

export type { CategoryCardEntryRow } from './EntryRowItem'

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
  onShowHistory?: () => void
  secondaryAction?: { label: string; onClick: () => void }
  highlight?: { value: string; unit: string }
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
  onShowHistory,
  secondaryAction,
  highlight,
}: CategoryCardProps) {
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
        {moreLines.length > 0 && onShowHistory && (
          <button type="button" className="link-button" onClick={onShowHistory}>
            Entries since yesterday
          </button>
        )}
      </div>
    </section>
  )
}
