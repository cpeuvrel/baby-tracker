import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { StatsPage } from './StatsPage'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

const sleep: SleepEntry[] = [
  {
    id: 's1',
    startedAt: '2026-03-05T21:00:00.000Z',
    endedAt: '2026-03-05T22:00:00.000Z',
    durationSeconds: 3600,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T21:00:00.000Z',
  },
]
const feeding: FeedingEntry[] = [
  {
    id: 'f1',
    type: 'bottle',
    startedAt: '2026-03-05T10:00:00.000Z',
    endedAt: '2026-03-05T10:10:00.000Z',
    durationSeconds: 600,
    volumeMl: 120,
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T10:00:00.000Z',
  },
]
const diaper: DiaperEntry[] = [
  {
    id: 'd1',
    type: 'pee',
    occurredAt: '2026-03-05T10:00:00.000Z',
    notes: '',
    createdBy: 'uid1',
    createdAt: '2026-03-05T10:00:00.000Z',
  },
]

describe('StatsPage', () => {
  beforeEach(() => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({ feeding, sleep, diaper })
  })

  it('renders nothing without a resolved household and baby', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = render(<StatsPage />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows aggregated stat tiles for the selected range', () => {
    render(<StatsPage />)

    const valueFor = (label: string) => screen.getByText(label).nextElementSibling?.textContent

    expect(valueFor('Sommeil total')).toBe('1h 00min')
    expect(valueFor('Réveils nocturnes')).toBe('1')
    expect(valueFor('Biberons')).toBe('1')
    expect(valueFor('Volume total')).toBe('120 mL')
  })

  it('switches to the week range and recomputes the average per day', async () => {
    const user = userEvent.setup()
    render(<StatsPage />)

    await user.click(screen.getByRole('button', { name: 'Semaine' }))

    expect(useEntriesInRangeModule.useEntriesInRange).toHaveBeenLastCalledWith(
      'h1',
      'b1',
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    )
  })
})
