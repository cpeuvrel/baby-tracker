import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { Layout } from './Layout'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Maëlys', birthDate: '2025-06-01', sex: null }

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<p>Contenu</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  it("shows the baby's name, an avatar and today's date in the header", () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    const { container } = renderLayout()

    expect(screen.getByText('Maëlys')).toBeInTheDocument()
    expect(container.querySelector('.app-header-avatar svg')).toBeInTheDocument()
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })
})
