import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('keeps focus on the field being edited when the parent re-renders with a new onClose', () => {
    const { rerender } = render(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={() => {}}>
        <input aria-label="Champ" />
      </Modal>,
    )
    const field = screen.getByLabelText('Champ')
    field.focus()

    rerender(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={() => {}}>
        <input aria-label="Champ" />
      </Modal>,
    )

    expect(field).toHaveFocus()
  })

  it('calls the latest onClose on Escape', async () => {
    const first = vi.fn()
    const latest = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={first}>
        <p>Contenu</p>
      </Modal>,
    )
    rerender(
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={latest}>
        <p>Contenu</p>
      </Modal>,
    )
    await user.keyboard('{Escape}')

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })
})
