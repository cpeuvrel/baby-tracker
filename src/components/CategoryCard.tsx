import { useState } from 'react'

interface CategoryCardProps {
  title: string
  colorVar: string
  addLabel: string
  onAdd: () => void
  lines: string[]
  emptyLabel: string
  secondaryAction?: { label: string; onClick: () => void }
  highlight?: { value: string; unit: string }
}

export function CategoryCard({
  title,
  colorVar,
  addLabel,
  onAdd,
  lines,
  emptyLabel,
  secondaryAction,
  highlight,
}: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [firstLine, ...remainingLines] = lines

  return (
    <section className="category-card" aria-label={title}>
      <header style={{ background: `var(${colorVar})` }}>
        <h3>{title}</h3>
        <button type="button" aria-label={addLabel} className="add-button" onClick={onAdd}>
          +
        </button>
      </header>
      <div className="category-card-body">
        <div className="category-card-first-row">
          <p>{firstLine ?? emptyLabel}</p>
          {highlight && firstLine && (
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
        {remainingLines.length > 0 && (
          <>
            <button type="button" className="link-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Réduire' : 'Voir plus'}
            </button>
            {expanded && (
              <ul>
                {remainingLines.map((line, index) => (
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
