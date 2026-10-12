import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import type { SleepEntry } from '../types/models'
import { ActiveTimersBanner } from './ActiveTimersBanner'

const stopSleep = vi.fn().mockResolvedValue(undefined)

vi.mock('../repositories/sleepEntries', () => ({
  stopSleep: (...args: unknown[]) => stopSleep(...args),
}))

vi.mock('../lib/pushRegistration', () => ({ registerPush: vi.fn().mockResolvedValue(undefined) }))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'uid1' } }) }))

vi.mock('../lib/sleepTimerNotification', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/sleepTimerNotification')>()),
  showSleepTimerNotification: vi.fn().mockResolvedValue(undefined),
  closeSleepTimerNotification: vi.fn().mockResolvedValue(undefined),
}))

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderBanner() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <ActiveTimersBanner />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Mocks the running sleeps the banner sees; call the returned function to change them. */
function mockActiveSleeps(entries: SleepEntry[]) {
  const spy = vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntriesState')
  const set = (next: SleepEntry[]) => spy.mockReturnValue({ entries: next, loading: false, error: null })
  set(entries)
  return set
}

const runningSleep: SleepEntry = {
  id: 'sleep1',
  startedAt: '2026-03-05T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  notes: '',
  createdBy: 'uid1',
  createdAt: '2026-03-05T20:00:00.000Z',
}

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('ActiveTimersBanner', () => {
  beforeEach(() => {
    stopSleep.mockReset().mockResolvedValue(undefined)
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when no sleep timer is active', () => {
    mockActiveSleeps([])

    renderBanner()

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('shows the active sleep timer and stops it on click', async () => {
    const sleepEntry: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    mockActiveSleeps([sleepEntry])
    const user = userEvent.setup()

    renderBanner()
    expect(screen.getByText(/Sleep in progress for/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date('2026-03-05T20:00:00.000Z'))
  })
  it('warns when two sleep timers run and stops them all', async () => {
    const first: SleepEntry = {
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }
    const second: SleepEntry = { ...first, id: 'sleep2', startedAt: '2026-03-05T20:03:00.000Z' }
    mockActiveSleeps([first, second])
    const user = userEvent.setup()

    renderBanner()
    expect(screen.getByText(/2 sleep timers were started at the same time/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop all' }))

    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep1', new Date(first.startedAt))
    expect(stopSleep).toHaveBeenCalledWith('h1', 'b1', 'sleep2', new Date(second.startedAt))
  })

  it('opens the sleep timer when the running time is tapped', async () => {
    mockActiveSleeps([{
      id: 'sleep1',
      startedAt: '2026-03-05T20:00:00.000Z',
      endedAt: null,
      durationSeconds: null,
      notes: '',
      createdBy: 'uid1',
      createdAt: '2026-03-05T20:00:00.000Z',
    }])
    const user = userEvent.setup()

    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Sleep in progress, open the timer' }))

    expect(screen.getByTestId('where')).toHaveTextContent('/?timer=sleep')
  })

  it('announces when a sleep starts or stops, never the elapsed time', () => {
    const setActive = mockActiveSleeps([])
    const { rerender } = renderBanner()

    setActive([runningSleep])
    rerender(
      <MemoryRouter initialEntries={['/history']}>
        <ActiveTimersBanner />
      </MemoryRouter>,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Sleep timer started.')
    expect(status).not.toHaveTextContent(/\d/)
    expect(document.querySelector('[aria-live]')).toBeNull()

    setActive([])
    rerender(
      <MemoryRouter initialEntries={['/history']}>
        <ActiveTimersBanner />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Sleep timer stopped.')
  })

  it('does not announce a sleep already running when the app opens', () => {
    mockActiveSleeps([runningSleep])
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('hides the ticking counter from screen readers', () => {
    mockActiveSleeps([runningSleep])
    renderBanner()

    const button = screen.getByRole('button', { name: 'Sleep in progress, open the timer' })
    expect(button.querySelector('[aria-hidden="true"]')).toHaveTextContent(/\d/)
  })

  it('reports a failed stop', async () => {
    mockActiveSleeps([runningSleep])
    stopSleep.mockRejectedValue(new Error('network'))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save this sleep. Please try again.'))
  })
})
