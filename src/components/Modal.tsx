import { useEffect, useRef, type ReactNode } from 'react'

interface ModalHeaderAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface ModalProps {
  title: string
  bandColorVar: string
  onClose: () => void
  headerAction?: ModalHeaderAction
  /** Close when tapping the dimmed area around the dialog (off by default: forms would lose their input). */
  closeOnOverlayClick?: boolean
  children: ReactNode
}

export function Modal({
  title,
  bandColorVar,
  onClose,
  headerAction,
  closeOnOverlayClick = false,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Only a press that both starts and ends on the overlay closes it (not a drag out of the dialog).
  const pressStartedOnOverlay = useRef(false)

  useEffect(() => {
    dialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onPointerDown={(event) => {
        pressStartedOnOverlay.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (closeOnOverlayClick && pressStartedOnOverlay.current && event.target === event.currentTarget) onClose()
        pressStartedOnOverlay.current = false
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
      >
        <header
          style={{
            background: `var(${bandColorVar})`,
            // Category bands keep their light color in dark mode: keep their text dark too.
            color: bandColorVar.startsWith('--category-') ? 'var(--on-category)' : 'var(--text)',
          }}
        >
          <button type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
          <h2>{title}</h2>
          {headerAction && (
            <button
              type="button"
              className="modal-header-action"
              onClick={headerAction.onClick}
              disabled={headerAction.disabled}
            >
              {headerAction.label}
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
