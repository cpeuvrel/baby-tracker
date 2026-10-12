import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { NotebookIcon } from '../components/icons'
import { VisitItemEditorModal } from '../components/VisitItemEditorModal'
import { useCurrentVisit } from '../hooks/useCurrentVisit'
import { appendItem, editItem, newItemId, removeItem } from '../lib/visitItems'
import { formatVisitDate } from '../lib/visitDate'
import { mutateVisitItems } from '../repositories/pediatricianVisits'
import type { VisitRemark } from '../types/models'

const FIELDS = [{ name: 'text', label: 'Remark' }]

export function VisitRemarksPage() {
  const { household, baby, visit } = useCurrentVisit()
  // `'new'` while adding, the remark while editing one.
  const [editing, setEditing] = useState<VisitRemark | 'new' | null>(null)

  if (visit === null) return <Navigate to="/account/pediatrician" replace />
  if (!household || !baby || !visit) return null

  // Each change applies to the latest stored remarks: the other parent's changes stay.
  const change = (mutate: (remarks: VisitRemark[]) => VisitRemark[]) =>
    mutateVisitItems(household.id, baby.id, visit.id, 'remarks', mutate)

  return (
    <div>
      <div className="detail-header">
        <Link to={`/account/pediatrician/visits/${visit.id}`} aria-label="Back">
          ‹
        </Link>
        <h2>Remarks</h2>
      </div>
      <p className="hint">{formatVisitDate(visit.date)}</p>

      {visit.remarks.length === 0 ? (
        <EmptyState colorVar="--category-feeding" icon={<NotebookIcon />}>
          No remarks yet. Jot down what the pediatrician noticed.
        </EmptyState>
      ) : (
        <ul className="list-group list-group-large">
          {visit.remarks.map((remark) => (
            <li key={remark.id}>
              <button type="button" className="list-row-button visit-item" onClick={() => setEditing(remark)}>
                <span className="visit-item-text">{remark.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="button-action" onClick={() => setEditing('new')}>
        Add remark
      </button>

      {editing && (
        <VisitItemEditorModal
          title={editing === 'new' ? 'New Remark' : 'Remark'}
          fields={FIELDS}
          initialValues={{ text: editing === 'new' ? '' : editing.text }}
          onSave={({ text }) =>
            change(editing === 'new' ? appendItem({ id: newItemId(), text }) : editItem(editing.id, { text }))
          }
          onDelete={editing === 'new' ? undefined : () => change(removeItem(editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
