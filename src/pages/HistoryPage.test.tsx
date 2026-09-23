import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistoryPage } from './HistoryPage'

vi.mock('../components/WeekTimelineChart', () => ({
  WeekTimelineChart: ({
    onSelectDay,
    showChart,
  }: {
    onSelectDay: (date: Date) => void
    showChart?: boolean
  }) => (
    <div>
      <button type="button" onClick={() => onSelectDay(new Date('2026-03-04T00:00:00.000Z'))}>
        pick-day
      </button>
      <p>{showChart ? 'chart visible' : 'chart hidden'}</p>
    </div>
  ),
}))
vi.mock('../components/DailyTimeline', () => ({
  DailyTimeline: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

describe('HistoryPage', () => {
  it('shows only the graph by default, not the daily timeline', () => {
    render(<HistoryPage />)

    expect(screen.getByText('chart visible')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })

  it('switches to the data view showing the daily timeline for the picked day, and back to the graph', async () => {
    const user = userEvent.setup()
    render(<HistoryPage />)

    await user.click(screen.getByRole('button', { name: 'pick-day' }))
    await user.click(screen.getByRole('button', { name: 'Show data' }))

    expect(screen.getByText('chart hidden')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('March')

    await user.click(screen.getByRole('button', { name: 'Show graph' }))

    expect(screen.getByText('chart visible')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })

  it('opens the filters modal from the header and closes it on Apply', async () => {
    const user = userEvent.setup()
    render(<HistoryPage />)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()

    await user.click(screen.getByLabelText('Sleep'))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
