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
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- tapping the dimmed area is a pointer shortcut: Escape and the buttons close it from the keyboard (useDialogBehavior)
    <div className="action-menu-overlay" onClick={onClose}>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops the tap reaching the overlay */}
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
