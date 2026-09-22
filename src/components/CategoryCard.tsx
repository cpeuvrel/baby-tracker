import { useState, type ReactNode } from 'react'

interface CategoryCardProps {
  title: string
  colorVar: string
  addLabel: string
  onAdd: () => void
  icon: ReactNode
  primary: { label: string; meta: string } | null
  emptyLabel: string
  moreLines: string[]
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
  emptyLabel,
  moreLines,
  secondaryAction,
  highlight,
}: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false)

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
          <div className="category-card-primary-text">
            {primary ? (
              <>
                <p className="category-card-label">{primary.label}</p>
                <p className="category-card-meta">{primary.meta}</p>
              </>
            ) : (
              <p className="category-card-label">{emptyLabel}</p>
            )}
          </div>
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
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}
