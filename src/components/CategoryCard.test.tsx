import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryCard } from './CategoryCard'

describe('CategoryCard', () => {
  it('shows the empty label when there are no entries', () => {
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        lines={[]}
        emptyLabel="Aucune entrée"
      />,
    )

    expect(screen.getByText('Aucune entrée')).toBeInTheDocument()
  })

  it('shows only the most recent line without a Voir plus link when there is a single entry', () => {
    render(
      <CategoryCard
        title="Sommeil"
        colorVar="--category-sleep"
        addLabel="Ajouter une entrée sommeil"
        onAdd={vi.fn()}
        lines={['1h 00min — il y a 30min']}
        emptyLabel="Aucune entrée"
      />,
    )

    expect(screen.getByText('1h 00min — il y a 30min')).toBeInTheDocument()
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
        lines={['Entrée récente', 'Entrée plus ancienne']}
        emptyLabel="Aucune entrée"
      />,
    )

    expect(screen.queryByText('Entrée plus ancienne')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Voir plus' }))

    expect(screen.getByText('Entrée plus ancienne')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeInTheDocument()
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
        lines={[]}
        emptyLabel="Aucune entrée"
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
        lines={[]}
        emptyLabel="Aucune entrée"
        secondaryAction={{ label: 'Régler le rappel', onClick: onSecondary }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Régler le rappel' }))

    expect(onSecondary).toHaveBeenCalled()
  })
})
