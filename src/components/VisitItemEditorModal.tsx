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

const SAVE_ERROR = 'Could not save. Check your connection and try again.'

/** Once the editor is gone, only an alert can still tell that the text was not kept. */
function alertLostText(values: Record<string, string>) {
  window.alert(`${SAVE_ERROR}\n\n${Object.values(values).filter(Boolean).join('\n')}`)
}

/**
 * Text editor for a remark or a question/answer pair: Save, or Discard (confirmed when edited).
 * Leaving the screen with it open (e.g. the phone's back gesture) saves the edits.
 * A failed save or delete keeps the editor open with an error (writes need the network).
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
  const [error, setError] = useState<string | null>(null)
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
    autosaveRef.current =
      dirty && !empty
        ? () => {
            const kept = trimmedValues()
            onSave(kept).catch((cause: unknown) => {
              console.error('[pediatrician] autosave failed', cause)
              alertLostText(kept)
            })
          }
        : null
  })
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (!settledRef.current) autosaveRef.current?.()
    }
  }, [])

  const submit = () => {
    if (empty || saving) return
    setSaving(true)
    setError(null)
    settledRef.current = true
    const kept = trimmedValues()
    void onSave(kept)
      .then(onClose)
      .catch((cause: unknown) => {
        console.error('[pediatrician] save failed', cause)
        // Left the screen while saving: the editor cannot show the error any more.
        if (!mountedRef.current) return alertLostText(kept)
        settledRef.current = false
        setSaving(false)
        setError(SAVE_ERROR)
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!onDelete || saving || !window.confirm('Delete this entry?')) return
    setSaving(true)
    setError(null)
    settledRef.current = true
    void onDelete()
      .then(onClose)
      .catch((cause: unknown) => {
        console.error('[pediatrician] delete failed', cause)
        settledRef.current = false
        setSaving(false)
        setError('Could not delete. Check your connection and try again.')
      })
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
        {error && <p role="alert">{error}</p>}
        <div className="visit-item-actions">
          <button type="button" onClick={discard}>
            Discard
          </button>
          {onDelete && (
            <button type="button" className="button-delete" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
