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
    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalled()
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
})
