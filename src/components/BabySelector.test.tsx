import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import type { Baby } from '../types/models'
import { BabySelector } from './BabySelector'

const babies: Baby[] = [
  { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null },
  { id: 'b2', name: 'Nina', birthDate: '2026-01-15', sex: null },
]

describe('BabySelector', () => {
  const selectBaby = vi.fn()

  beforeEach(() => {
    selectBaby.mockReset()
  })

  it('renders nothing when there are no babies', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby,
    })

    const { container } = render(<BabySelector />)

    expect(container).toBeEmptyDOMElement()
  })

  it('lists babies and lets the user pick one', async () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: { id: 'h1', name: 'Famille Test', memberUids: [] },
      babies,
      loading: false,
      selectedBaby: babies[0],
      selectBaby,
    })
    const user = userEvent.setup()

    render(<BabySelector />)

    await user.selectOptions(screen.getByLabelText('Baby'), 'b2')

    expect(selectBaby).toHaveBeenCalledWith('b2')
  })
})
