import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders the title and children', () => {
    render(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={vi.fn()}>
        <p>Contenu</p>
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Sommeil' })).toBeInTheDocument()
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={onClose}>
        <p>Contenu</p>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('renders a header action and calls it when clicked', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()

    render(
      <Modal
        title="Sommeil"
        bandColorVar="--category-sleep"
        onClose={vi.fn()}
        headerAction={{ label: 'Save', onClick: onSave }}
      >
        <p>Contenu</p>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={onClose}>
        <p>Contenu</p>
      </Modal>,
    )
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on a click outside the dialog only when closeOnOverlayClick is set', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    const { container, rerender } = render(
      <Modal title="Filters" bandColorVar="--category-sleep" onClose={onClose}>
        <p>Contenu</p>
      </Modal>,
    )
    const overlay = container.querySelector('.modal-overlay') as HTMLElement
    await user.click(overlay)
    expect(onClose).not.toHaveBeenCalled()

    rerender(
      <Modal title="Filters" bandColorVar="--category-sleep" onClose={onClose} closeOnOverlayClick>
        <p>Contenu</p>
      </Modal>,
    )
    await user.click(screen.getByText('Contenu'))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the focus on a field when the parent re-renders with a new onClose', async () => {
    const user = userEvent.setup()
    const firstClose = vi.fn()
    const lastClose = vi.fn()

    const { rerender } = render(
      <Modal title="Feed" bandColorVar="--category-feeding" onClose={firstClose}>
        <input aria-label="Notes" />
      </Modal>,
    )
    const input = screen.getByLabelText('Notes')
    await user.click(input)
    expect(input).toHaveFocus()

    rerender(
      <Modal title="Feed" bandColorVar="--category-feeding" onClose={lastClose}>
        <input aria-label="Notes" />
      </Modal>,
    )
    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(lastClose).toHaveBeenCalledTimes(1)
    expect(firstClose).not.toHaveBeenCalled()
  })

  it('focuses the dialog when it opens and gives the focus back to the opener when it closes', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && (
            <Modal title="Feed" bandColorVar="--category-feeding" onClose={() => setOpen(false)}>
              <input aria-label="Notes" />
            </Modal>
          )}
        </>
      )
    }
    render(<Harness />)

    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)
    expect(screen.getByRole('dialog', { name: 'Feed' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('locks the page scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = render(
      <Modal title="Feed" bandColorVar="--category-feeding" onClose={vi.fn()}>
        <p>Contenu</p>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Behind</button>
        <Modal
          title="Feed"
          bandColorVar="--category-feeding"
          onClose={vi.fn()}
          headerAction={{ label: 'Save', onClick: vi.fn() }}
        >
          <input aria-label="Notes" />
        </Modal>
      </>,
    )
    const close = screen.getByRole('button', { name: 'Close' })
    const notes = screen.getByLabelText('Notes')

    notes.focus()
    await user.tab()
    expect(close).toHaveFocus()

    await user.tab({ shift: true })
    expect(notes).toHaveFocus()
  })

  it('makes a header action with formId the submit button of that form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <Modal
        title="Feed"
        bandColorVar="--category-feeding"
        onClose={vi.fn()}
        headerAction={{ label: 'Save', formId: 'feed-form' }}
      >
        <form id="feed-form" onSubmit={onSubmit}>
          <input aria-label="Volume" type="number" min="1" defaultValue="-5" />
        </form>
      </Modal>,
    )
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveAttribute('type', 'submit')
    expect(save).toHaveAttribute('form', 'feed-form')

    // The browser refuses the invalid value before onSubmit.
    await user.click(save)
    expect(onSubmit).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Volume'))
    await user.type(screen.getByLabelText('Volume'), '120')
    await user.click(save)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
