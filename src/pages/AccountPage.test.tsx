import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AccountPage } from './AccountPage'

describe('AccountPage', () => {
  it('links to the Children, Pediatrician and Settings screens', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Children/ })).toHaveAttribute('href', '/account/family')
    expect(screen.getByRole('link', { name: /Pediatrician/ })).toHaveAttribute('href', '/account/pediatrician')
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/account/settings')
  })
})
