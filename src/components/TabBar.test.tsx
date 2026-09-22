import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  it('marks the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/trends']}>
        <TabBar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Trends' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Activity' })).not.toHaveAttribute('aria-current')
  })

  it('lists all four tabs', () => {
    render(
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trends' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Family' })).toBeInTheDocument()
  })
})
