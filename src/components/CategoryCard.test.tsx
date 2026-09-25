import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryCard } from './CategoryCard'
import { SleepIcon, TimerIcon } from './icons'

type CardProps = ComponentProps<typeof CategoryCard>

function renderCard(overrides: Partial<CardProps> = {}) {
  return render(
    <CategoryCard
      title="Sleep"
      colorVar="--category-sleep"
      addLabel="Add a sleep entry"
      onAdd={vi.fn()}
      icon={<SleepIcon />}
      primary={{ label: 'Woke up', meta: '30m ago' }}
      emptyLabel="No entries"
      {...overrides}
    />,
  )
}

describe('CategoryCard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the empty label when there is no primary entry, without a history link', () => {
    renderCard({ primary: null, onShowHistory: vi.fn() })

    expect(screen.getByText('No entries')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View History' })).not.toBeInTheDocument()
  })

  it('offers View History when there is a last entry but nothing recent', async () => {
    const onShowHistory = vi.fn()
    const user = userEvent.setup()
    renderCard({ onShowHistory })

    expect(screen.getByText('Woke up')).toBeInTheDocument()
    expect(screen.getByText('30m ago')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View History' }))

    expect(onShowHistory).toHaveBeenCalled()
  })

  it('keeps recent entries behind Show More, then lists them with the history link', async () => {
    const onSelectRow = vi.fn()
    const onShowHistory = vi.fn()
    const user = userEvent.setup()
    renderCard({
      lines: [{ title: '08:33 Bottle', value: '40 mL', barFraction: 0.5, onClick: onSelectRow }],
      onShowHistory,
      historyLabel: 'Entries before 20:00',
    })

    expect(screen.queryByText('08:33 Bottle')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show More' }))

    expect(screen.getByText('40 mL')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /08:33 Bottle/ }))
    expect(onSelectRow).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Entries before 20:00' }))
    expect(onShowHistory).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Show Less' }))
    expect(screen.queryByText('08:33 Bottle')).not.toBeInTheDocument()
  })

  it('remembers that a card was expanded', async () => {
    const user = userEvent.setup()
    const lines = [{ title: '08:33 Bottle', onClick: vi.fn() }]
    const { unmount } = renderCard({ lines })
    await user.click(screen.getByRole('button', { name: 'Show More' }))
    unmount()

    renderCard({ lines })

    expect(screen.getByText('08:33 Bottle')).toBeInTheDocument()
  })

  it('lists pinned rows directly, with the value on the right of a subtitle', () => {
    renderCard({
      showPrimary: false,
      primary: null,
      pinnedRows: [{ title: 'Weight', subtitle: 'Jul 10, 2026', value: '6.48 kg', onClick: vi.fn() }],
    })

    expect(screen.getByText('Jul 10, 2026')).toBeInTheDocument()
    expect(screen.getByText('6.48 kg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()
  })

  it('shows a custom add icon and active styling when provided', () => {
    renderCard({ addLabel: 'View the running timer', addIcon: <TimerIcon />, addActive: true })

    expect(screen.getByRole('button', { name: 'View the running timer' }).className).toContain('add-button-active')
  })

  it('calls onSelectPrimary when the primary entry is clicked', async () => {
    const onSelectPrimary = vi.fn()
    const user = userEvent.setup()
    renderCard({ onSelectPrimary })

    await user.click(screen.getByText('Woke up'))

    expect(onSelectPrimary).toHaveBeenCalled()
  })

  it('calls onAdd when the + button is clicked', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    renderCard({ onAdd })

    await user.click(screen.getByRole('button', { name: 'Add a sleep entry' }))

    expect(onAdd).toHaveBeenCalled()
  })

  it('renders and triggers the secondary action when provided', async () => {
    const onSecondary = vi.fn()
    const user = userEvent.setup()
    renderCard({ secondaryAction: { label: 'Set reminder', onClick: onSecondary } })

    await user.click(screen.getByRole('button', { name: 'Set reminder' }))

    expect(onSecondary).toHaveBeenCalled()
  })

  it('shows the highlight value next to the primary entry, with an optional unit', () => {
    renderCard({ highlight: { value: '120', unit: 'mL' } })

    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('mL')).toBeInTheDocument()
  })

  it('does not show a highlight value when there is no primary entry', () => {
    renderCard({ primary: null, highlight: { value: 'mix' } })

    expect(screen.queryByText('mix')).not.toBeInTheDocument()
  })
})
