import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useDayTimelineModule from '../hooks/useDayTimeline'
import type { TimelineEntry } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, SleepEntry } from '../types/models'
import { DailyTimeline } from './DailyTimeline'

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('DailyTimeline', () => {
  beforeEach(() => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('shows a placeholder when there are no entries today', () => {
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([])

    render(<DailyTimeline />)

    expect(screen.getByText('No entries yet.')).toBeInTheDocument()
  })

  it('describes feeding, sleep and diaper entries', () => {
    const sleep: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: '2026-03-05T21:30:00.000Z',
      durationSeconds: 5400,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const feeding: FeedingEntry = {
      id: 'f1',
      type: 'bottle',
      occurredAt: '2026-03-05T18:00:00.000Z',
      volumeMl: 120,
      foodType: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T18:00:00.000Z',
    }
    const diaper: DiaperEntry = {
      id: 'd1',
      type: 'both',
      occurredAt: '2026-03-05T17:00:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T17:00:00.000Z',
    }
    const timeline: TimelineEntry[] = [
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
      { kind: 'feeding', at: feeding.occurredAt, entry: feeding },
      { kind: 'diaper', at: diaper.occurredAt, entry: diaper },
    ]
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(timeline)

    render(<DailyTimeline />)

    expect(screen.getByText(/Sleep \(1h 30m\)/)).toBeInTheDocument()
    expect(screen.getByText(/Bottle 120 mL/)).toBeInTheDocument()
    expect(screen.getByText(/Diaper \(Wet \+ Dirty\)/)).toBeInTheDocument()
  })

  it('shows the food type for a solid feeding entry', () => {
    const solid: FeedingEntry = {
      id: 'f2',
      type: 'solid',
      occurredAt: '2026-03-05T12:00:00.000Z',
      volumeMl: null,
      foodType: 'carrot purée',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T12:00:00.000Z',
    }
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([
      { kind: 'feeding', at: solid.occurredAt, entry: solid },
    ])

    render(<DailyTimeline />)

    expect(screen.getByText(/Solid \(carrot purée\)/)).toBeInTheDocument()
  })

  it('accepts a custom title and date', () => {
    const spy = vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([])
    const date = new Date('2026-03-04T00:00:00.000Z')

    render(<DailyTimeline date={date} title="Wed, Mar 4" />)

    expect(screen.getByText('Wed, Mar 4')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('h1', 'b1', date)
  })
})
