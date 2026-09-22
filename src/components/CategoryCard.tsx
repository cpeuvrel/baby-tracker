import { useState } from 'react'

interface CategoryCardProps {
  title: string
  colorVar: string
  addLabel: string
  onAdd: () => void
  lines: string[]
  emptyLabel: string
}

export function CategoryCard({ title, colorVar, addLabel, onAdd, lines, emptyLabel }: CategoryCardProps) {
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
        <p>{firstLine ?? emptyLabel}</p>
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
