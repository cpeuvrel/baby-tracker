import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActionMenu } from './ActionMenu'

function renderMenu(onClose = vi.fn()) {
  render(
    <ActionMenu title="Add to Routine" onClose={onClose}>
      <button type="button">Bath</button>
      <button type="button">Cancel</button>
    </ActionMenu>,
  )
  return onClose
}

describe('ActionMenu', () => {
  it('takes the focus when it opens', () => {
    renderMenu()

    expect(screen.getByRole('dialog', { name: 'Add to Routine' })).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = renderMenu()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a tap outside the menu, not inside it', async () => {
    const user = userEvent.setup()
    const onClose = renderMenu()

    await user.click(screen.getByRole('heading', { name: 'Add to Routine' }))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(document.querySelector('.action-menu-overlay') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab inside the menu', async () => {
    const user = userEvent.setup()
    renderMenu()

    screen.getByRole('button', { name: 'Cancel' }).focus()
    await user.tab()

    expect(screen.getByRole('button', { name: 'Bath' })).toHaveFocus()
  })
})
