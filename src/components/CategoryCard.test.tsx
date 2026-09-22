import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryCard } from './CategoryCard'
import { SleepIcon, TimerIcon } from './icons'

describe('CategoryCard', () => {
  it('shows the empty label when there is no primary entry', () => {
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="No entries"
        moreLines={[]}
      />,
    )

    expect(screen.getByText('No entries')).toBeInTheDocument()
  })

  it('shows the primary label and meta without a Show more link when there is nothing more', () => {
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Woke up', meta: '30m ago' }}
        emptyLabel="No entries"
        moreLines={[]}
      />,
    )

    expect(screen.getByText('Woke up')).toBeInTheDocument()
    expect(screen.getByText('30m ago')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('expands to show older entries on Show more', async () => {
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Woke up', meta: '30m ago' }}
        emptyLabel="No entries"
        moreLines={[{ title: 'Older entry', onClick: vi.fn() }]}
      />,
    )

    expect(screen.queryByText('Older entry')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show more' }))

    expect(screen.getByText('Older entry')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()
  })

  it('calls the onClick of a more-line entry when clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Woke up', meta: '30m ago' }}
        emptyLabel="No entries"
        moreLines={[{ title: 'Older entry', onClick: onSelect }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    await user.click(screen.getByRole('button', { name: /Older entry/ }))

    expect(onSelect).toHaveBeenCalled()
  })

  it('shows a value and proportional bar next to a row when provided', async () => {
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Feed"
        colorVar="--category-feeding"
        addLabel="Add a feeding entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Last feeding', meta: '30m ago' }}
        emptyLabel="No entries"
        moreLines={[{ title: '08:33 Bottle', value: '40 mL', barFraction: 0.5, onClick: vi.fn() }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show more' }))

    expect(screen.getByText('40 mL')).toBeInTheDocument()
  })

  it('shows today lines directly, without a Show more toggle', async () => {
    const onSelectToday = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Woke up', meta: '30m ago' }}
        emptyLabel="No entries"
        todayLines={[{ title: "Today's entry", onClick: onSelectToday }]}
        moreLines={[]}
      />,
    )

    expect(screen.getByText("Today's entry")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Today's entry/ }))

    expect(onSelectToday).toHaveBeenCalled()
  })

  it('shows a custom add icon and active styling when provided', () => {
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="View the running timer"
        onAdd={vi.fn()}
        addIcon={<TimerIcon />}
        addActive
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="No entries"
        moreLines={[]}
      />,
    )

    const addButton = screen.getByRole('button', { name: 'View the running timer' })
    expect(addButton.className).toContain('add-button-active')
  })

  it('calls onSelectPrimary when the primary entry is clicked', async () => {
    const onSelectPrimary = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Woke up', meta: '30m ago' }}
        onSelectPrimary={onSelectPrimary}
        emptyLabel="No entries"
        moreLines={[]}
      />,
    )

    await user.click(screen.getByText('Woke up'))

    expect(onSelectPrimary).toHaveBeenCalled()
  })

  it('calls onAdd when the + button is clicked', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sleep"
        colorVar="--category-sleep"
        addLabel="Add a sleep entry"
        onAdd={onAdd}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="No entries"
        moreLines={[]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add a sleep entry' }))

    expect(onAdd).toHaveBeenCalled()
  })

  it('renders and triggers the secondary action when provided', async () => {
    const onSecondary = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Medication"
        colorVar="--category-medication"
        addLabel="Add a dose"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="No entries"
        moreLines={[]}
        secondaryAction={{ label: 'Set reminder', onClick: onSecondary }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Set reminder' }))

    expect(onSecondary).toHaveBeenCalled()
  })

  it('shows the highlight value next to the primary entry', () => {
    render(
      <CategoryCard
        title="Feed"
        colorVar="--category-feeding"
        addLabel="Add a feeding entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Last feeding', meta: '30m ago' }}
        emptyLabel="No entries"
        moreLines={[]}
        highlight={{ value: '120', unit: 'mL' }}
      />,
    )

    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('mL')).toBeInTheDocument()
  })

  it('does not show a highlight value when there is no primary entry', () => {
    render(
      <CategoryCard
        title="Feed"
        colorVar="--category-feeding"
        addLabel="Add a feeding entry"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="No entries"
        moreLines={[]}
        highlight={{ value: '120', unit: 'mL' }}
      />,
    )

    expect(screen.queryByText('120')).not.toBeInTheDocument()
  })
})
