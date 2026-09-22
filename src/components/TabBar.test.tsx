import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  it('marks the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/stats']}>
        <TabBar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Suivi' })).not.toHaveAttribute('aria-current')
  })

  it('lists all three tabs', () => {
    render(
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Suivi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stats' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Croissance' })).toBeInTheDocument()
  })
})
