import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ChatIcon } from '../components/icons'
import { VisitItemEditorModal } from '../components/VisitItemEditorModal'
import { useCurrentVisit } from '../hooks/useCurrentVisit'
import { editItem, newItemId, removeItem } from '../lib/visitItems'
import { formatVisitDate } from '../lib/visitDate'
import { appendVisitItem, mutateVisitItems } from '../repositories/pediatricianVisits'
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

  // Each change applies to the latest stored questions: the other parent's changes stay.
  const change = (mutate: (discussions: VisitDiscussion[]) => VisitDiscussion[]) =>
    mutateVisitItems(household.id, baby.id, visit.id, 'discussions', mutate)

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
        <EmptyState colorVar="--category-sleep" icon={<ChatIcon />}>
          No questions yet. Note what you want to ask, and the answers.
        </EmptyState>
      ) : (
        <ul className="list-group list-group-large">
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
            editing === 'new'
              ? // A plain array union: queued while offline, merged with the other phone's additions.
                appendVisitItem(household.id, baby.id, visit.id, 'discussions', { id: newItemId(), question, answer })
              : change(editItem(editing.id, { question, answer }))
          }
          onDelete={editing === 'new' ? undefined : () => change(removeItem(editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
