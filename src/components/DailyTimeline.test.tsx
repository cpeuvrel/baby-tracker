import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useDayTimelineModule from '../hooks/useDayTimeline'
import type { DayTimeline } from '../hooks/useDayTimeline'
import type { EntryKind } from '../lib/historyFilters'
import type { TimelineEntry } from '../lib/timeline'
import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../types/models'
import { DailyTimeline } from './DailyTimeline'

const updateSleepEntry = vi.fn().mockResolvedValue(undefined)
const deleteSleepEntry = vi.fn()

vi.mock('../repositories/sleepEntries', () => ({
  updateSleepEntry: (...args: unknown[]) => updateSleepEntry(...args),
  deleteSleepEntry: (...args: unknown[]) => deleteSleepEntry(...args),
  startSleep: vi.fn().mockResolvedValue(undefined),
  stopSleep: vi.fn(),
  logSleep: vi.fn(),
  resumeSleep: vi.fn().mockResolvedValue(undefined),
  subscribeToActiveSleeps: () => () => {},
  subscribeToRecentSleepEntries: () => () => {},
}))

/** What useDayTimeline returns: the day's rows, and the sleeps loaded for its total (by default, the rows'). */
function day(timeline: TimelineEntry[], sleep?: SleepEntry[]): DayTimeline {
  return {
    timeline,
    sleep: sleep ?? timeline.flatMap((item) => (item.kind === 'sleep' ? [item.entry] : [])),
  }
}

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('DailyTimeline', () => {
  beforeEach(() => {
    updateSleepEntry.mockReset().mockResolvedValue(undefined)
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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day([]))

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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day(timeline))

    render(<DailyTimeline />)

    // 18:00 UTC is 19:00 in Paris (UTC+1 in March), whatever the device's time zone
    expect(screen.getByText(/19:00 Bottle/)).toBeInTheDocument()
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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day([
      { kind: 'feeding', at: solid.occurredAt, entry: solid },
    ]))

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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day([
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
      { kind: 'diaper', at: diaper.occurredAt, entry: diaper },
    ]))

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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day([
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
    ]))
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
    vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day([
      { kind: 'sleep', at: sleep.startedAt, entry: sleep },
      { kind: 'feeding', at: feeding.occurredAt, entry: feeding },
    ]))

    render(<DailyTimeline date={new Date('2026-03-05T12:00:00.000Z')} />)

    expect(screen.getByText('120 mL total')).toBeInTheDocument()
    expect(screen.getByText('1h 30m total sleep')).toBeInTheDocument()
  })

  describe('total sleep', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('counts last night on the morning it ends and a running nap up to now', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-06T11:00:00+01:00'))
      // 21:00 the evening before → 06:00 (9h), then a nap running since 09:30 (1h 30m so far).
      const night: SleepEntry = {
        id: 'night',
        startedAt: '2026-03-05T21:00:00+01:00',
        endedAt: '2026-03-06T06:00:00+01:00',
        durationSeconds: 9 * 3600,
        notes: '',
        createdBy: 'uid1',
        createdAt: '2026-03-05T21:00:00+01:00',
      }
      const nap: SleepEntry = {
        id: 'nap',
        startedAt: '2026-03-06T09:30:00+01:00',
        endedAt: null,
        durationSeconds: null,
        notes: '',
        createdBy: 'uid1',
        createdAt: '2026-03-06T09:30:00+01:00',
      }
      // Rows list sleeps on the day they start: only the nap; the total takes both.
      vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(
        day([{ kind: 'sleep', at: nap.startedAt, entry: nap }], [night, nap]),
      )

      render(<DailyTimeline />)

      expect(screen.getByText('10h 30m total sleep')).toBeInTheDocument()
      expect(screen.getByText(/Timer running/)).toBeInTheDocument()
    })

    it('leaves out a sleep that ends the next day', () => {
      vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(
        day([
          {
            kind: 'sleep',
            at: '2026-03-05T21:00:00+01:00',
            entry: {
              id: 'night',
              startedAt: '2026-03-05T21:00:00+01:00',
              endedAt: '2026-03-06T06:00:00+01:00',
              durationSeconds: 9 * 3600,
              notes: '',
              createdBy: 'uid1',
              createdAt: '2026-03-05T21:00:00+01:00',
            },
          },
        ]),
      )

      render(<DailyTimeline date={new Date('2026-03-05T12:00:00+01:00')} />)

      expect(screen.getByText('0m total sleep')).toBeInTheDocument()
    })
  })

  it('accepts a custom title and date', () => {
    const spy = vi.spyOn(useDayTimelineModule, 'useDayTimeline').mockReturnValue(day([]))
    const date = new Date('2026-03-04T00:00:00.000Z')

    render(<DailyTimeline date={date} title="Wed, Mar 4" />)

    expect(screen.getByText('Wed, Mar 4')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith('h1', 'b1', date)
  })
})
