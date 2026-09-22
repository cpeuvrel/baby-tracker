import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryCard } from './CategoryCard'
import { SleepIcon } from './icons'

describe('CategoryCard', () => {
  it('shows the empty label when there is no primary entry', () => {
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="Aucune entrée"
        moreLines={[]}
      />,
    )

    expect(screen.getByText('Aucune entrée')).toBeInTheDocument()
  })

  it('shows the primary label and meta without a Voir plus link when there is nothing more', () => {
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Réveillé', meta: 'il y a 30min' }}
        emptyLabel="Aucune entrée"
        moreLines={[]}
      />,
    )

    expect(screen.getByText('Réveillé')).toBeInTheDocument()
    expect(screen.getByText('il y a 30min')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument()
  })

  it('expands to show older entries on Voir plus', async () => {
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Réveillé', meta: 'il y a 30min' }}
        emptyLabel="Aucune entrée"
        moreLines={[{ text: 'Entrée plus ancienne', onClick: vi.fn() }]}
      />,
    )

    expect(screen.queryByText('Entrée plus ancienne')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Voir plus' }))

    expect(screen.getByText('Entrée plus ancienne')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeInTheDocument()
  })

  it('calls the onClick of a more-line entry when clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Réveillé', meta: 'il y a 30min' }}
        emptyLabel="Aucune entrée"
        moreLines={[{ text: 'Entrée plus ancienne', onClick: onSelect }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Voir plus' }))
    await user.click(screen.getByRole('button', { name: 'Entrée plus ancienne' }))

    expect(onSelect).toHaveBeenCalled()
  })

  it('shows today lines directly, without a Voir plus toggle', async () => {
    const onSelectToday = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Réveillé', meta: 'il y a 30min' }}
        emptyLabel="Aucune entrée"
        todayLines={[{ text: 'Entrée du jour', onClick: onSelectToday }]}
        moreLines={[]}
      />,
    )

    expect(screen.getByText('Entrée du jour')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Entrée du jour' }))

    expect(onSelectToday).toHaveBeenCalled()
  })

  it('calls onSelectPrimary when the primary entry is clicked', async () => {
    const onSelectPrimary = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Réveillé', meta: 'il y a 30min' }}
        onSelectPrimary={onSelectPrimary}
        emptyLabel="Aucune entrée"
        moreLines={[]}
      />,
    )

    await user.click(screen.getByText('Réveillé'))

    expect(onSelectPrimary).toHaveBeenCalled()
  })

  it('calls onAdd when the + button is clicked', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={onAdd}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="Aucune entrée"
        moreLines={[]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Ajouter une entrée sommeil' }))

    expect(onAdd).toHaveBeenCalled()
  })

  it('renders and triggers the secondary action when provided', async () => {
    const onSecondary = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryCard
        title="Médicament"
        colorVar="--category-medication"
        addLabel="Ajouter une prise"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="Aucune entrée"
        moreLines={[]}
        secondaryAction={{ label: 'Régler le rappel', onClick: onSecondary }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Régler le rappel' }))

    expect(onSecondary).toHaveBeenCalled()
  })

  it('shows the highlight value next to the primary entry', () => {
    render(
      <CategoryCard
        title="Nourriture"
        colorVar="--category-feeding"
        addLabel="Ajouter une entrée nourriture"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={{ label: 'Dernier biberon', meta: 'il y a 30min' }}
        emptyLabel="Aucune entrée"
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
        title="Nourriture"
        colorVar="--category-feeding"
        addLabel="Ajouter une entrée nourriture"
        onAdd={vi.fn()}
        icon={<SleepIcon />}
        primary={null}
        emptyLabel="Aucune entrée"
        moreLines={[]}
        highlight={{ value: '120', unit: 'mL' }}
      />,
    )

    expect(screen.queryByText('120')).not.toBeInTheDocument()
  })
})
