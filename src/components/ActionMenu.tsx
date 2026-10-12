import { useRef, type ReactNode } from 'react'
import { useDialogBehavior } from '../hooks/useDialogBehavior'

interface ActionMenuProps {
  title: string
  onClose: () => void
  /** The menu's buttons. */
  children: ReactNode
}

/**
 * A short list of actions over the dimmed screen: focused when it opens, closed by Escape or a
 * tap outside, the focus kept inside and given back to the opener, like `Modal`.
 */
export function ActionMenu({ title, onClose, children }: ActionMenuProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogBehavior(dialogRef, onClose)

  return (
    <div className="action-menu-overlay" onClick={onClose}>
      <div
        className="action-menu"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
