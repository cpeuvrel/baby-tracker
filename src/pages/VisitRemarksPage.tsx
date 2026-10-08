import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { VisitItemEditorModal } from '../components/VisitItemEditorModal'
import { useCurrentVisit } from '../hooks/useCurrentVisit'
import { newItemId } from '../lib/visitItems'
import { formatVisitDate } from '../lib/visitDate'
import { updatePediatricianVisit } from '../repositories/pediatricianVisits'
import type { VisitRemark } from '../types/models'

const FIELDS = [{ name: 'text', label: 'Remark' }]

export function VisitRemarksPage() {
  const { household, baby, visit } = useCurrentVisit()
  // `'new'` while adding, the remark while editing one.
  const [editing, setEditing] = useState<VisitRemark | 'new' | null>(null)

  if (visit === null) return <Navigate to="/account/pediatrician" replace />
  if (!household || !baby || !visit) return null

  const save = (remarks: VisitRemark[]) => updatePediatricianVisit(household.id, baby.id, visit.id, { remarks })

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
        <p className="hint">No remarks yet.</p>
      ) : (
        <ul className="list-group">
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
            save(
              editing === 'new'
                ? [...visit.remarks, { id: newItemId(), text }]
                : visit.remarks.map((remark) => (remark.id === editing.id ? { ...remark, text } : remark)),
            )
          }
          onDelete={
            editing === 'new'
              ? undefined
              : () => save(visit.remarks.filter((remark) => remark.id !== editing.id))
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
