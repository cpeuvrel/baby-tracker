import { useState, type ReactNode } from 'react'
import { BlobIcon } from './BlobIcon'
import { EntryRowItem, type CategoryCardEntryRow } from './EntryRowItem'

export type { CategoryCardEntryRow } from './EntryRowItem'

const EXPANDED_STORAGE_PREFIX = 'baby-tracker:expandedCard:'

function readExpanded(title: string): boolean {
  try {
    return localStorage.getItem(EXPANDED_STORAGE_PREFIX + title) === 'true'
  } catch {
    return false
  }
}

function writeExpanded(title: string, expanded: boolean) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_PREFIX + title, String(expanded))
  } catch {
    /* storage unavailable (private browsing): the card simply forgets its state */
  }
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
  highlight?: { value: string; unit?: string }
  /** Recent entries, behind a Show More / Show Less toggle unless `collapsible` is false. */
  lines?: CategoryCardEntryRow[]
  collapsible?: boolean
  onShowHistory?: () => void
  /** Label of the history link under the expanded entries (e.g. "Entries before 20:00"). */
  historyLabel?: string
  secondaryAction?: { label: string; onClick: () => void }
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
  highlight,
  lines = [],
  collapsible = true,
  onShowHistory,
  historyLabel = 'View History',
  secondaryAction,
}: CategoryCardProps) {
  const [expanded, setExpanded] = useState(() => readExpanded(title))

  const toggleExpanded = () => {
    setExpanded(!expanded)
    writeExpanded(title, !expanded)
  }

  const primaryText = (
    <span className="category-card-primary-text">
      <span className="category-card-label">{primary ? primary.label : emptyLabel}</span>
      {primary && <span className="category-card-meta">{primary.meta}</span>}
    </span>
  )

  const rowList = (
    <ul className="category-card-rows">
      {lines.map((row, index) => (
        <EntryRowItem key={index} {...row} colorVar={colorVar} />
      ))}
    </ul>
  )

  const historyLink = (label: string) =>
    onShowHistory && (
      <button type="button" className="category-card-link" onClick={onShowHistory}>
        {label}
        <span className="category-card-link-icon" aria-hidden="true">
          ›
        </span>
      </button>
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
            <BlobIcon colorVar={colorVar} size="large">
              {icon}
            </BlobIcon>
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
                {highlight.unit && <sup>{highlight.unit}</sup>}
              </p>
            )}
          </div>
        )}
        {!collapsible && lines.length > 0 && rowList}
        {collapsible && lines.length > 0 && (
          <>
            <button type="button" className="category-card-link" aria-expanded={expanded} onClick={toggleExpanded}>
              {expanded ? 'Show Less' : 'Show More'}
              <span className="category-card-link-icon category-card-toggle-icon" aria-hidden="true">
                {expanded ? '︿' : '﹀'}
              </span>
            </button>
            {expanded && (
              <>
                {rowList}
                {historyLink(historyLabel)}
              </>
            )}
          </>
        )}
        {collapsible && lines.length === 0 && primary && historyLink('View History')}
        {secondaryAction && (
          <button type="button" className="category-card-link" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
            <span className="category-card-link-icon" aria-hidden="true">
              ›
            </span>
          </button>
        )}
      </div>
    </section>
  )
}
