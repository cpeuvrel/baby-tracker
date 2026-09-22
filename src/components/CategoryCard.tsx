import { useState, type ReactNode } from 'react'

export interface CategoryCardMoreLine {
  text: string
  onClick: () => void
}

interface CategoryCardProps {
  title: string
  colorVar: string
  addLabel: string
  onAdd: () => void
  icon: ReactNode
  primary: { label: string; meta: string } | null
  onSelectPrimary?: () => void
  emptyLabel: string
  moreLines: CategoryCardMoreLine[]
  secondaryAction?: { label: string; onClick: () => void }
  highlight?: { value: string; unit: string }
}

export function CategoryCard({
  title,
  colorVar,
  addLabel,
  onAdd,
  icon,
  primary,
  onSelectPrimary,
  emptyLabel,
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
        <button type="button" aria-label={addLabel} className="add-button" onClick={onAdd}>
          +
        </button>
      </header>
      <div className="category-card-body">
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
        {secondaryAction && (
          <button type="button" className="link-button" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </button>
        )}
        {moreLines.length > 0 && (
          <>
            <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Réduire' : 'Voir plus'}
            </button>
            {expanded && (
              <ul>
                {moreLines.map((line, index) => (
                  <li key={index}>
                    <button type="button" className="category-card-more-line" onClick={line.onClick}>
                      {line.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}
