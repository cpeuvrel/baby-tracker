import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AccountPage } from './AccountPage'

describe('AccountPage', () => {
  it('links to the Family and Settings screens', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Family/ })).toHaveAttribute('href', '/account/family')
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/account/settings')
  })
})
