import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useDayTimelineModule from '../hooks/useDayTimeline'
import type { EntryKind } from '../lib/historyFilters'
import type { TimelineEntry } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { DailyTimeline } from './DailyTimeline'

const updateSleepEntry = vi.fn()
const deleteSleepEntry = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  updateSleepEntry: (...args: unknown[]) => updateSleepEntry(...args),
  deleteSleepEntry: (...args: unknown[]) => deleteSleepEntry(...args),
  startSleep: vi.fn(),
  stopSleep: vi.fn(),
  logSleep: vi.fn(),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('DailyTimeline', () => {
  beforeEach(() => {
    updateSleepEntry.mockReset()
    deleteSleepEntry.mockReset()
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

  it('shows feeding, sleep, diaper and medication rows with a time, value and chevron', () => {
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
    const medication: MedicationEntry = {
      id: 'm1',
      name: 'Vitamin D',
      givenAt: '2026-03-05T08:00:00.000Z',
      dose: '2 drops',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T08:00:00.000Z',
    }
    const timeline: TimelineEntry[] = [
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
      { kind: 'feeding', at: feeding.occurredAt, entry: feeding },
      { kind: 'diaper', at: diaper.occurredAt, entry: diaper },
      { kind: 'medication', at: medication.givenAt, entry: medication },
    ]
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(timeline)

    render(<DailyTimeline />)

    expect(screen.getByText(/07:00 PM Bottle/)).toBeInTheDocument()
    expect(screen.getByText('120 mL')).toBeInTheDocument()
    expect(screen.getByText(/Wet \+ Dirty/)).toBeInTheDocument()
    expect(screen.getByText(/Vitamin D/)).toBeInTheDocument()
    expect(screen.getByText('2 drops')).toBeInTheDocument()
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

    expect(screen.getByText(/carrot purée/)).toBeInTheDocument()
  })

  it('filters rows to the given kinds while keeping the day totals unaffected', () => {
    const sleep: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: '2026-03-05T21:30:00.000Z',
      durationSeconds: 5400,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const diaper: DiaperEntry = {
      id: 'd1',
      type: 'wet',
      occurredAt: '2026-03-05T17:00:00.000Z',
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T17:00:00.000Z',
    }
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
      { kind: 'diaper', at: diaper.occurredAt, entry: diaper },
    ])

    render(<DailyTimeline visibleKinds={new Set<EntryKind>(['sleep'])} />)

    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.queryByText(/Wet/)).not.toBeInTheDocument()
  })

  it('opens the sleep entry editor when a sleep row is clicked', async () => {
    const sleep: SleepEntry = {
      id: 's1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: '2026-03-05T21:30:00.000Z',
      durationSeconds: 5400,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
    ])
    const user = userEvent.setup()

    render(<DailyTimeline />)
    await user.click(screen.getByRole('button', { name: /–/ }))

    expect(screen.getByRole('dialog', { name: 'Sleep' })).toBeInTheDocument()
  })

  it('shows the day totals for feeding and sleep', () => {
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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
      { kind: 'feeding', at: feeding.occurredAt, entry: feeding },
    ])

    render(<DailyTimeline />)

    expect(screen.getByText('120 mL total')).toBeInTheDocument()
    expect(screen.getByText('1h 30m total sleep')).toBeInTheDocument()
  })

  it('accepts a custom title and date', () => {
    const spy = vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue([])
    const date = new Date('2026-03-04T00:00:00.000Z')

    render(<DailyTimeline date={date} title="Wed, Mar 4" />)

    expect(screen.getByText('Wed, Mar 4')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('h1', 'b1', date)
  })
})
