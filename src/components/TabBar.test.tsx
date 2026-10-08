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

  it('switches to Activity, visit History and Family on the pediatrician screens', () => {
    render(
      <MemoryRouter initialEntries={['/account/pediatrician/visits/v1']}>
        <TabBar />
      </MemoryRouter>,
    )

    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Activity', 'History', 'Family'])
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/account/pediatrician/history')
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Family' })).not.toHaveAttribute('aria-current')
  })
})
