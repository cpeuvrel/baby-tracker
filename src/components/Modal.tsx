import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  bandColorVar: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, bandColorVar, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay">
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
      >
        <header style={{ background: `var(${bandColorVar})` }}>
          <button type="button" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
          <h2>{title}</h2>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
