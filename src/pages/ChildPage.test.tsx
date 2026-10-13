import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChildPage } from './ChildPage'
import { defaultBaby, mockHousehold } from '../test/mockContexts'

const updateBaby = vi.fn()
const exportBabyData = vi.fn()
const deleteBabyWithData = vi.fn()

vi.mock('../repositories/babies', () => ({
  updateBaby: (...args: unknown[]) => updateBaby(...args),
  updateBabyPhoto: vi.fn(),
}))

vi.mock('../lib/babyExport', () => ({
  exportBabyData: (...args: unknown[]) => exportBabyData(...args),
  deleteBabyWithData: (...args: unknown[]) => deleteBabyWithData(...args),
  importBabyData: vi.fn(),
  parseImportFile: vi.fn(),
  serializeBabyExport: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'uid1' },
    loading: false,
    error: null,
    devLoginAvailable: false,
    loginWithGoogle: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
  }),
}))

const sister = { id: 'b2', name: 'Mia', birthDate: '2024-01-01', sex: null }

function mockBabies(babies: (typeof defaultBaby)[]) {
  mockHousehold({ babies, selectedBaby: babies[0] ?? null })
}

function page(babyId = 'b1') {
  return (
    <MemoryRouter initialEntries={[`/account/family/${babyId}`]}>
      <Routes>
        <Route path="/account/family/:babyId" element={<ChildPage />} />
        <Route path="/account/family" element={<p>Children list</p>} />
        <Route path="/account/family/add" element={<p>Add child screen</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderPage(babyId = 'b1') {
  return render(page(babyId))
}

describe('ChildPage', () => {
  beforeEach(() => {
    updateBaby.mockReset().mockResolvedValue(undefined)
    deleteBabyWithData.mockReset().mockResolvedValue(undefined)
    localStorage.clear()
    mockHousehold()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to the children list when the baby cannot be found', () => {
    renderPage('unknown')

    expect(screen.getByText('Children list')).toBeInTheDocument()
  })

  it('redirects to Add Child when no child is left', () => {
    mockBabies([])

    renderPage()

    expect(screen.getByText('Add child screen')).toBeInTheDocument()
  })

  it('pre-fills the profile form with the baby and shows its computed age', () => {
    renderPage()

    expect(screen.getByLabelText('First Name')).toHaveValue('Léo')
    expect(screen.getByLabelText('Birthdate')).toHaveValue('2025-06-01')
    expect(screen.getByText('Age')).toBeInTheDocument()
  })

  it('has no "Use Adjusted Age" control and no Notes & Photos section', () => {
    renderPage()

    expect(screen.queryByText(/Adjusted Age/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Notes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Photos/)).not.toBeInTheDocument()
  })

  it('saves the edited profile', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.clear(screen.getByLabelText('First Name'))
    await user.type(screen.getByLabelText('First Name'), 'Léo Martin')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateBaby).toHaveBeenCalledWith('h1', 'b1', 'Léo Martin', '2025-06-01', null)
    expect(await screen.findByText('Children list')).toBeInTheDocument()
  })

  it('saves once on a double tap', async () => {
    let finish!: () => void
    updateBaby.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    renderPage()

    await user.dblClick(screen.getByRole('button', { name: 'Save' }))

    expect(updateBaby).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    finish()
    expect(await screen.findByText('Children list')).toBeInTheDocument()
  })

  it('stays on the profile and says so when it cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateBaby.mockRejectedValue(new Error('permission-denied'))
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.queryByText('Children list')).not.toBeInTheDocument()
  })

  it('keeps the name being typed when the children are updated (e.g. the photo is saved)', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPage()
    await user.clear(screen.getByLabelText('First Name'))
    await user.type(screen.getByLabelText('First Name'), 'Léon')

    mockBabies([{ ...defaultBaby, photoDataUrl: 'data:image/jpeg;base64,AAA' } as typeof defaultBaby])
    rerender(page())

    expect(screen.getByLabelText('First Name')).toHaveValue('Léon')
  })

  it('shows the profile of another child when the address changes', async () => {
    mockBabies([defaultBaby, sister])
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/account/family/b1']}>
        <Link to="/account/family/b2">Open Mia</Link>
        <Routes>
          <Route path="/account/family/:babyId" element={<ChildPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('First Name')).toHaveValue('Léo')

    await user.click(screen.getByRole('link', { name: 'Open Mia' }))

    expect(screen.getByLabelText('First Name')).toHaveValue('Mia')
  })

  it('links to the Edit Activities screen for this baby', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /Edit Activities/ })).toHaveAttribute(
      'href',
      '/account/family/b1/activities',
    )
  })

  it('offers Export Data for this baby', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Export Data (CSV)' })).toBeInTheDocument()
  })

  it('links to Nighttime Hours, defaulting to 20:00 - 08:00', () => {
    renderPage()

    const link = screen.getByRole('link', { name: /Nighttime Hours/ })
    expect(link).toHaveAttribute('href', '/account/family/b1/nighttime-hours')
    expect(link).toHaveTextContent('20:00 - 08:00')
  })

  it('shows a customized Nighttime Hours range', () => {
    mockHousehold({ babies: [{ ...defaultBaby, nighttimeHours: { start: '21:00', end: '06:30' } }] })

    renderPage()

    expect(screen.getByRole('link', { name: /Nighttime Hours/ })).toHaveTextContent(
      '21:00 - 06:30',
    )
  })

  it('has no Unit toggle', () => {
    renderPage()

    expect(screen.queryByRole('group', { name: 'Unit' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Imperial/)).not.toBeInTheDocument()
  })

  it('says so when the child cannot be deleted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteBabyWithData.mockRejectedValue(new Error('unavailable'))
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Delete Child' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete Léo.')
    expect(screen.getByRole('button', { name: 'Delete Child' })).toBeEnabled()
  })

  it('deletes the child after a confirmation naming them', async () => {
    mockBabies([defaultBaby, sister])
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Delete Child' }))

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Delete Léo?'))
    expect(deleteBabyWithData).toHaveBeenCalledWith('h1', 'b1')
    expect(await screen.findByText('Children list')).toBeInTheDocument()
  })

  it('opens Add Child after deleting the last child', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Delete Child' }))

    expect(deleteBabyWithData).toHaveBeenCalledWith('h1', 'b1')
    expect(await screen.findByText('Add child screen')).toBeInTheDocument()
  })

  it('keeps the child when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Delete Child' }))

    expect(deleteBabyWithData).not.toHaveBeenCalled()
  })
})
