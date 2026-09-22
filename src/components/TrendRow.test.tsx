import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FeedIcon } from './icons'
import { TrendRow } from './TrendRow'

function renderRow(delta: { value: number; direction: 'up' | 'down' | 'flat' }) {
  return render(
    <MemoryRouter>
      <TrendRow
        to="/trends/feedSessions"
        icon={<FeedIcon />}
        title="Bottles"
        subtitle="4.0 bottles / day"
        delta={delta}
        deltaLabel="1.0"
        colorVar="--category-feeding"
      />
    </MemoryRouter>,
  )
}

describe('TrendRow', () => {
  it('links to the metric detail page and shows title/subtitle', () => {
    renderRow({ value: 0, direction: 'flat' })

    const link = screen.getByRole('link', { name: /Bottles/ })
    expect(link).toHaveAttribute('href', '/trends/feedSessions')
    expect(screen.getByText('4.0 bottles / day')).toBeInTheDocument()
  })

  it('shows an up arrow badge when the delta increased', () => {
    renderRow({ value: 1, direction: 'up' })

    expect(screen.getByText('↑ 1.0')).toBeInTheDocument()
  })

  it('shows a down arrow badge when the delta decreased', () => {
    renderRow({ value: -1, direction: 'down' })

    expect(screen.getByText('↓ 1.0')).toBeInTheDocument()
  })

  it('hides the delta badge when the trend is flat', () => {
    renderRow({ value: 0, direction: 'flat' })

    expect(screen.queryByText('1.0')).not.toBeInTheDocument()
  })
})
