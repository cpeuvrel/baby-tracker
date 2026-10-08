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

/**
 * Text editor for a remark or a question/answer pair: Save, or Discard (confirmed when edited).
 * Leaving the screen with it open (e.g. the phone's back gesture) saves the edits.
 */
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
  // Set once the user saves, discards or deletes: only an unplanned unmount saves on its own.
  const settledRef = useRef(false)
  const discard = useCallback(() => {
    if (dirtyRef.current && !window.confirm('Discard your changes?')) return
    settledRef.current = true
    onClose()
  }, [onClose])

  const trimmedValues = () =>
    Object.fromEntries(fields.map((field) => [field.name, (values[field.name] ?? '').trim()]))
  const autosaveRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    autosaveRef.current = dirty && !empty ? () => void onSave(trimmedValues()) : null
  })
  useEffect(
    () => () => {
      if (!settledRef.current) autosaveRef.current?.()
    },
    [],
  )

  const submit = () => {
    if (empty || saving) return
    setSaving(true)
    settledRef.current = true
    void onSave(trimmedValues())
      .then(onClose)
      .catch((error: unknown) => {
        console.error('[pediatrician] save failed', error)
        settledRef.current = false
        setSaving(false)
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!onDelete || !window.confirm('Delete this entry?')) return
    settledRef.current = true
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
