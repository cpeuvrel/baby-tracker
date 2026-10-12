import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useEntriesInRangeModule from '../hooks/useEntriesInRange'
import type { Baby } from '../types/models'
import { Layout } from './Layout'

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'uid1' } }) }))
vi.mock('../lib/foregroundPush', () => ({ routeForegroundPushes: vi.fn().mockResolvedValue(() => {}) }))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby: Baby = { id: 'b1', name: 'Maëlys', birthDate: '2025-06-01', sex: null }

function mockHousehold(selectedBaby: Baby) {
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [selectedBaby],
    loading: false,
    error: null,
    selectedBaby,
    selectBaby: vi.fn(),
  })
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
    vi.spyOn(useEntriesInRangeModule, 'useEntriesInRange').mockReturnValue({
      feeding: [],
      sleep: [],
      diaper: [],
      medication: [],
      bath: [],
    })
  })

  it("shows the baby's name, an avatar and today's date in the header", () => {
    mockHousehold(baby)

    const { container } = renderLayout()

    expect(screen.getByText('Maëlys')).toBeInTheDocument()
    expect(container.querySelector('.app-header-avatar svg')).toBeInTheDocument()
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })

  it("shows the baby's photo next to the name when there is one", () => {
    mockHousehold({ ...baby, photoDataUrl: 'data:image/jpeg;base64,AAA' })

    const { container } = renderLayout()

    expect(container.querySelector('.app-header-avatar img')).toHaveAttribute('src', 'data:image/jpeg;base64,AAA')
  })

  it('opens the Summary from the "…" button on the Activity screen, and closes it', async () => {
    mockHousehold(baby)
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
    mockHousehold(baby)

    renderLayout('/history')

    expect(screen.queryByRole('button', { name: 'Summary' })).not.toBeInTheDocument()
  })

  it('opens the screen a notification tap names', () => {
    mockHousehold(baby)
    const postFromServiceWorker = stubServiceWorker()
    renderLayout()

    postFromServiceWorker({ type: 'navigate', url: '/history' })

    expect(screen.getByText('History screen')).toBeInTheDocument()
  })

  it.each(['https://evil.example/history', '//evil.example/history', '/\\evil.example/history'])(
    'ignores a notification URL that leaves the app: %s',
    (url) => {
      mockHousehold(baby)
      const postFromServiceWorker = stubServiceWorker()
      renderLayout()

      postFromServiceWorker({ type: 'navigate', url })

      expect(screen.getByText('Contenu')).toBeInTheDocument()
      expect(screen.queryByText('History screen')).not.toBeInTheDocument()
    },
  )

  it('keeps the header and tab bar when a screen fails, and lets another tab load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockHousehold(baby)
    const user = userEvent.setup()
    renderLayout('/trends')

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
    expect(screen.getByText('Maëlys')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'History' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('History screen')).toBeInTheDocument()
  })
})
