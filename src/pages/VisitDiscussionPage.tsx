import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { VisitItemEditorModal } from '../components/VisitItemEditorModal'
import { useCurrentVisit } from '../hooks/useCurrentVisit'
import { newItemId } from '../lib/visitItems'
import { formatVisitDate } from '../lib/visitDate'
import { updatePediatricianVisit } from '../repositories/pediatricianVisits'
import type { VisitDiscussion } from '../types/models'

const FIELDS = [
  { name: 'question', label: 'Question' },
  { name: 'answer', label: 'Answer' },
]

export function VisitDiscussionPage() {
  const { household, baby, visit } = useCurrentVisit()
  // `'new'` while adding, the entry while editing one.
  const [editing, setEditing] = useState<VisitDiscussion | 'new' | null>(null)

  if (visit === null) return <Navigate to="/account/pediatrician" replace />
  if (!household || !baby || !visit) return null

  const save = (discussions: VisitDiscussion[]) =>
    updatePediatricianVisit(household.id, baby.id, visit.id, { discussions })

  return (
    <div>
      <div className="detail-header">
        <Link to={`/account/pediatrician/visits/${visit.id}`} aria-label="Back">
          ‹
        </Link>
        <h2>Discussion</h2>
      </div>
      <p className="hint">{formatVisitDate(visit.date)}</p>

      {visit.discussions.length === 0 ? (
        <p className="hint">No questions yet.</p>
      ) : (
        <ul className="list-group">
          {visit.discussions.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="list-row-button visit-item" onClick={() => setEditing(entry)}>
                <span className="visit-item-question">{entry.question || 'No question'}</span>
                <span className="visit-item-text">{entry.answer || 'No answer yet'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="button-action" onClick={() => setEditing('new')}>
        Add question
      </button>

      {editing && (
        <VisitItemEditorModal
          title={editing === 'new' ? 'New Question' : 'Question'}
          fields={FIELDS}
          initialValues={
            editing === 'new' ? { question: '', answer: '' } : { question: editing.question, answer: editing.answer }
          }
          onSave={({ question, answer }) =>
            save(
              editing === 'new'
                ? [...visit.discussions, { id: newItemId(), question, answer }]
                : visit.discussions.map((entry) =>
                    entry.id === editing.id ? { ...entry, question, answer } : entry,
                  ),
            )
          }
          onDelete={
            editing === 'new'
              ? undefined
              : () => save(visit.discussions.filter((entry) => entry.id !== editing.id))
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
