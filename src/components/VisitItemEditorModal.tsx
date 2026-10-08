import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from './Modal'

export interface VisitItemField {
  name: string
  label: string
}

interface VisitItemEditorModalProps {
  title: string
  fields: VisitItemField[]
  initialValues: Record<string, string>
  onSave: (values: Record<string, string>) => Promise<void>
  /** Shown for an existing item only. */
  onDelete?: () => Promise<void>
  onClose: () => void
}

/** Text editor for a remark or a question/answer pair: Save, or Discard (confirmed when edited). */
export function VisitItemEditorModal({
  title,
  fields,
  initialValues,
  onSave,
  onDelete,
  onClose,
}: VisitItemEditorModalProps) {
  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const dirty = fields.some((field) => (values[field.name] ?? '') !== (initialValues[field.name] ?? ''))
  const empty = fields.every((field) => (values[field.name] ?? '').trim() === '')

  // Stable handler: the Modal re-focuses its dialog whenever `onClose` changes, which would
  // steal focus from the text area on every keystroke.
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  const discard = useCallback(() => {
    if (dirtyRef.current && !window.confirm('Discard your changes?')) return
    onClose()
  }, [onClose])

  const submit = () => {
    if (empty || saving) return
    setSaving(true)
    const trimmed = Object.fromEntries(fields.map((field) => [field.name, (values[field.name] ?? '').trim()]))
    void onSave(trimmed)
      .then(onClose)
      .catch((error: unknown) => {
        console.error('[pediatrician] save failed', error)
        setSaving(false)
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!onDelete || !window.confirm('Delete this entry?')) return
    void onDelete().then(onClose)
  }

  return (
    <Modal
      title={title}
      bandColorVar="--category-medication"
      onClose={discard}
      headerAction={{ label: 'Save', onClick: submit, disabled: empty || saving }}
    >
      <form onSubmit={handleSubmit}>
        {fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={`visit-item-${field.name}`}>{field.label}</label>
            <textarea
              id={`visit-item-${field.name}`}
              rows={5}
              value={values[field.name] ?? ''}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
            />
          </div>
        ))}
        <div className="visit-item-actions">
          <button type="button" onClick={discard}>
            Discard
          </button>
          {onDelete && (
            <button type="button" className="button-delete" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
