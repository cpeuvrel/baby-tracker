import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistoryPage } from './HistoryPage'

vi.mock('../components/WeekTimelineChart', () => ({
  WeekTimelineChart: ({ onSelectDay }: { onSelectDay: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelectDay(new Date('2026-03-04T00:00:00.000Z'))}>
      pick-day
    </button>
  ),
}))
vi.mock('../components/DailyTimeline', () => ({
  DailyTimeline: ({ title }: { title: string }) => <h2>{title}</h2>,
}))

describe('HistoryPage', () => {
  it('shows a title for today by default and updates it when a day is picked', async () => {
    const user = userEvent.setup()

    render(<HistoryPage />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'pick-day' }))

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('March')
  })
})
