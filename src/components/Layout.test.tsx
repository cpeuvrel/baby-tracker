import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as useActiveSleepEntryModule from '../hooks/useActiveSleepEntry'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import { mockHousehold } from '../test/mockContexts'
import type { Baby } from '../types/models'
import { Layout } from './Layout'

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'uid1' } }) }))

const baby: Baby = { id: 'b1', name: 'Maëlys', birthDate: '2025-06-01', sex: null }

function mockSelectedBaby(selectedBaby: Baby | null) {
  mockHousehold({ babies: selectedBaby ? [selectedBaby] : [], selectedBaby })
}

function BrokenScreen(): never {
  throw new Error('boom')
}

function renderLayout(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<p>Contenu</p>} />
          <Route path="history" element={<p>History screen</p>} />
          <Route path="trends" element={<BrokenScreen />} />
          <Route path="account" element={<p>Family screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

/** Stands in for the service worker container, which forwards notification taps as messages. */
function stubServiceWorker() {
  const container = new EventTarget()
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container })
  return (data: unknown) => act(() => void container.dispatchEvent(new MessageEvent('message', { data })))
}

describe('Layout', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    // The header's active-timers banner subscribes to the running sleeps.
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntries').mockReturnValue([])
    vi.spyOn(useActiveSleepEntryModule, 'useActiveSleepEntriesState').mockReturnValue({
      entries: [],
      loading: false,
      error: null,
    })
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
      bath: [],
    })
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRangeState').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
      bath: [],
      loading: false,
      error: null,
    })
  })

  it("shows the baby's name, an avatar and today's date in the header", () => {
    mockSelectedBaby(baby)

    const { container } = renderLayout()

    expect(screen.getByText('Maëlys')).toBeInTheDocument()
    expect(container.querySelector('.app-header-avatar svg')).toBeInTheDocument()
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })

  it("shows the baby's photo next to the name when there is one", () => {
    mockSelectedBaby({ ...baby, photoDataUrl: 'data:image/jpeg;base64,AAA' })

    const { container } = renderLayout()

    expect(container.querySelector('.app-header-avatar img')).toHaveAttribute('src', 'data:image/jpeg;base64,AAA')
  })

  it('opens the Summary from the "…" button on the Activity screen, and closes it', async () => {
    mockSelectedBaby(baby)
    const user = userEvent.setup()

    renderLayout()
    await user.click(screen.getByRole('button', { name: 'Summary' }))

    expect(screen.getByRole('dialog', { name: 'Summary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Nothing logged yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('has no "…" button on other screens', () => {
    mockSelectedBaby(baby)

    renderLayout('/history')

    expect(screen.queryByRole('button', { name: 'Summary' })).not.toBeInTheDocument()
  })

  it('opens the screen a notification tap names', () => {
    mockSelectedBaby(baby)
    const postFromServiceWorker = stubServiceWorker()
    renderLayout()

    postFromServiceWorker({ type: 'navigate', url: '/history' })

    expect(screen.getByText('History screen')).toBeInTheDocument()
  })

  it.each(['https://evil.example/history', '//evil.example/history', '/\\evil.example/history'])(
    'ignores a notification URL that leaves the app: %s',
    (url) => {
      mockSelectedBaby(baby)
      const postFromServiceWorker = stubServiceWorker()
      renderLayout()

      postFromServiceWorker({ type: 'navigate', url })

      expect(screen.getByText('Contenu')).toBeInTheDocument()
      expect(screen.queryByText('History screen')).not.toBeInTheDocument()
    },
  )

  it('keeps the header and tab bar when a screen fails, and lets another tab load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSelectedBaby(baby)
    const user = userEvent.setup()
    renderLayout('/trends')

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
    expect(screen.getByText('Maëlys')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'History' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('History screen')).toBeInTheDocument()
  })

  it('invites to add a child when the family has none', () => {
    mockSelectedBaby(null)

    renderLayout('/history')

    expect(screen.getByText(/No child yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a child' })).toHaveAttribute('href', '/account/family/add')
    expect(screen.queryByText('History screen')).not.toBeInTheDocument()
  })

  it('keeps the Family screens reachable without a child', () => {
    mockSelectedBaby(null)

    renderLayout('/account')

    expect(screen.getByText('Family screen')).toBeInTheDocument()
    expect(screen.queryByText(/No child yet/)).not.toBeInTheDocument()
  })
})
