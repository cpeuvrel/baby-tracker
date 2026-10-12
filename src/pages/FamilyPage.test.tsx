import { render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { FamilyPage } from './FamilyPage'
import { mockAuth, mockHousehold } from '../test/mockContexts'

const household = { id: 'h1', name: 'Famille Test', memberUids: ['uid1', 'uid2'] }

function renderPage() {
  return render(
    <MemoryRouter>
      <FamilyPage />
    </MemoryRouter>,
  )
}

describe('FamilyPage', () => {
  beforeEach(() => {
    mockAuth({ user: { uid: 'uid1', email: 'parent1@example.com' } as User })
  })

  it('renders nothing without a resolved household', () => {
    mockHousehold({ household: null, babies: [], selectedBaby: null })

    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })

  it('lists the babies of the household with their age, linking to their Child screen', () => {
    mockHousehold({ household })

    renderPage()

    expect(screen.getByText('Léo')).toBeInTheDocument()
    expect(screen.getByText(/^Age /)).toBeInTheDocument()
    expect(screen.getByText('Léo').closest('a')).toHaveAttribute('href', '/account/family/b1')
  })

  it('links "Add child" to the Add Child screen', () => {
    mockHousehold({ household, babies: [], selectedBaby: null })

    renderPage()

    expect(screen.getByRole('link', { name: 'Add child' })).toHaveAttribute(
      'href',
      '/account/family/add',
    )
  })

  it('lists the current user as "Your Profile" and other members generically', () => {
    mockHousehold({ household })

    renderPage()

    expect(screen.getByText('parent1@example.com')).toBeInTheDocument()
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Other caregiver')).toBeInTheDocument()
  })

  it('titles the screen once, its sections one level below', () => {
    mockHousehold({ household })

    renderPage()

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Children'])
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Children',
      'Caregivers',
    ])
  })
})
