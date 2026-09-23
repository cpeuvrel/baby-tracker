import { useState } from 'react'
import { KIND_OPTIONS, type EntryKind } from '../lib/historyFilters'
import { Modal } from './Modal'

interface HistoryFiltersModalProps {
  visibleKinds: Set<EntryKind>
  onApply: (kinds: Set<EntryKind>) => void
  onClose: () => void
}

export function HistoryFiltersModal({ visibleKinds, onApply, onClose }: HistoryFiltersModalProps) {
  const [pending, setPending] = useState<Set<EntryKind>>(() => new Set(visibleKinds))

  const toggle = (kind: EntryKind) => {
    setPending((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const handleApply = () => {
    onApply(pending)
    onClose()
  }

  return (
    <Modal
      title="Filters"
      bandColorVar="--category-sleep"
      onClose={onClose}
      headerAction={{ label: 'Apply', onClick: handleApply }}
    >
      <ul className="list-group">
        {KIND_OPTIONS.map(({ kind, label }) => (
          <li key={kind}>
            <label htmlFor={`history-filter-${kind}`}>{label}</label>
            <input
              id={`history-filter-${kind}`}
              type="checkbox"
              checked={pending.has(kind)}
              onChange={() => toggle(kind)}
            />
          </li>
        ))}
      </ul>
    </Modal>
  )
}
