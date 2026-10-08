import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import type { PediatricianVisit } from '../types/models'
import { PediatricianHistoryPage } from './PediatricianHistoryPage'
import { PediatricianPage } from './PediatricianPage'
import { PediatricianVisitPage } from './PediatricianVisitPage'
import { VisitDiscussionPage } from './VisitDiscussionPage'
import { VisitRemarksPage } from './VisitRemarksPage'

const addPediatricianVisit = vi.fn()
const updatePediatricianVisit = vi.fn()
let visitsByBaby: Record<string, PediatricianVisit[]> = {}

vi.mock('../repositories/pediatricianVisits', () => ({
  addPediatricianVisit: (...args: unknown[]) => addPediatricianVisit(...args),
  updatePediatricianVisit: (...args: unknown[]) => updatePediatricianVisit(...args),
  deletePediatricianVisit: vi.fn(),
  subscribeToPediatricianVisits: (_h: string, babyId: string, onChange: (v: PediatricianVisit[]) => void) => {
    onChange(visitsByBaby[babyId] ?? [])
    return () => {}
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'uid1' } }),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const leo = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }
const mia = { id: 'b2', name: 'Mia', birthDate: '2024-01-01', sex: null }

function visit(overrides: Partial<PediatricianVisit>): PediatricianVisit {
  return {
    id: 'v1',
    date: '2026-10-08',
    vaccinated: false,
    remarks: [],
    discussions: [],
    createdBy: 'uid1',
    createdAt: '2026-10-08T10:00:00.000Z',
    ...overrides,
  }
}

function selectBaby(baby: typeof leo) {
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [leo, mia],
    loading: false,
    error: null,
    selectedBaby: baby,
    selectBaby: vi.fn(),
  })
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/account/pediatrician" element={<PediatricianPage />} />
        <Route path="/account/pediatrician/history" element={<PediatricianHistoryPage />} />
        <Route path="/account/pediatrician/visits/:visitId" element={<PediatricianVisitPage />} />
        <Route path="/account/pediatrician/visits/:visitId/remarks" element={<VisitRemarksPage />} />
        <Route path="/account/pediatrician/visits/:visitId/discussion" element={<VisitDiscussionPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Pediatrician screens', () => {
  beforeEach(() => {
    addPediatricianVisit.mockReset()
    updatePediatricianVisit.mockReset().mockResolvedValue(undefined)
    visitsByBaby = {}
    selectBaby(leo)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a visit for the selected child and opens it', async () => {
    const user = userEvent.setup()
    addPediatricianVisit.mockResolvedValue('v9')
    visitsByBaby = { b1: [visit({ id: 'v9', date: '2026-09-30', vaccinated: true })] }
    renderAt('/account/pediatrician')

    await user.click(screen.getByRole('button', { name: /New Visit/ }))
    const dialog = screen.getByRole('dialog', { name: 'New Visit' })
    const dateInput = within(dialog).getByLabelText('Date')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-09-30')
    await user.click(within(dialog).getByRole('button', { name: 'Yes' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(addPediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'uid1', { date: '2026-09-30', vaccinated: true })
    expect(await screen.findByRole('heading', { name: 'Wed, Sep 30, 2026' })).toBeInTheDocument()
  })

  it('lists the selected child’s visits by date', () => {
    visitsByBaby = {
      b1: [visit({ id: 'v2', date: '2026-10-08', vaccinated: true }), visit({ id: 'v1', date: '2026-07-01' })],
      b2: [visit({ id: 'v3', date: '2026-01-15' })],
    }
    renderAt('/account/pediatrician/history')

    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-label') !== 'Back')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/account/pediatrician/visits/v2',
      '/account/pediatrician/visits/v1',
    ])
    expect(links[0]).toHaveTextContent('Thu, Oct 8, 2026')
    expect(links[0]).toHaveTextContent('Vaccine')
    expect(screen.queryByText(/Jan 15/)).not.toBeInTheDocument()
  })

  it('lists future visits apart, soonest first', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00.000Z'))
    visitsByBaby = {
      b1: [
        visit({ id: 'v4', date: '2027-01-10' }),
        visit({ id: 'v3', date: '2026-11-02' }),
        visit({ id: 'v2', date: '2026-10-08' }),
        visit({ id: 'v1', date: '2026-07-01' }),
      ],
    }
    renderAt('/account/pediatrician/history')
    vi.useRealTimers()

    const hrefs = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')?.split('/').pop())
    expect(hrefs('Upcoming')).toEqual(['v3', 'v4'])
    expect(hrefs('Past')).toEqual(['v2', 'v1'])
  })

  it('leaves a visit that does not belong to the selected child', () => {
    visitsByBaby = { b1: [visit({ id: 'v1' })] }
    selectBaby(mia)
    renderAt('/account/pediatrician/visits/v1')

    expect(screen.getByText('No visits yet.')).toBeInTheDocument()
  })

  it('opens the next upcoming visit, not the furthest one', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00.000Z'))
    visitsByBaby = {
      b1: [
        visit({ id: 'v3', date: '2027-01-10' }),
        visit({ id: 'v2', date: '2026-11-02' }),
        visit({ id: 'v1', date: '2026-07-01' }),
      ],
    }
    renderAt('/account/pediatrician')
    vi.useRealTimers()

    expect(screen.getByRole('heading', { name: 'Mon, Nov 2, 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Visit' })).toBeInTheDocument()
  })

  it('opens the history when no visit is planned', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00.000Z'))
    visitsByBaby = { b1: [visit({ id: 'v1', date: '2026-07-01' })] }
    renderAt('/account/pediatrician')
    vi.useRealTimers()

    expect(screen.getByRole('region', { name: 'Past' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Visit' })).toBeInTheDocument()
  })

  it('saves an edited remark when leaving the screen with the editor open', async () => {
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }] })] }
    const { unmount } = renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Good weight' }))
    await user.type(screen.getByRole('textbox', { name: 'Remark' }), '!')
    unmount()

    expect(updatePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1', {
      remarks: [{ id: 'r1', text: 'Good weight!' }],
    })
  })

  it('adds a remark', async () => {
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }] })] }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Add remark' }))
    await user.type(screen.getByRole('textbox', { name: 'Remark' }), '  Next visit in 2 months ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updatePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1', {
      remarks: [
        { id: 'r1', text: 'Good weight' },
        { id: expect.any(String), text: 'Next visit in 2 months' },
      ],
    })
  })

  it('asks before discarding an edited remark', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    visitsByBaby = { b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }] })] }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Good weight' }))
    await user.type(screen.getByRole('textbox', { name: 'Remark' }), '!')
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(confirm).toHaveBeenCalledWith('Discard your changes?')
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(updatePediatricianVisit).not.toHaveBeenCalled()
  })

  it('discards an untouched remark without asking', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    visitsByBaby = { b1: [visit({})] }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Add remark' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits the answer of an existing question', async () => {
    const user = userEvent.setup()
    visitsByBaby = {
      b1: [visit({ discussions: [{ id: 'd1', question: 'Vitamin D?', answer: '' }] })],
    }
    renderAt('/account/pediatrician/visits/v1/discussion')

    await user.click(screen.getByRole('button', { name: /Vitamin D\?/ }))
    await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'Until 18 months')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updatePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1', {
      discussions: [{ id: 'd1', question: 'Vitamin D?', answer: 'Until 18 months' }],
    })
  })

  it('shows remark and discussion counts on the visit', () => {
    visitsByBaby = {
      b1: [visit({ remarks: [{ id: 'r1', text: 'a' }], discussions: [] })],
    }
    renderAt('/account/pediatrician/visits/v1')

    expect(screen.getByRole('link', { name: /Remarks/ })).toHaveAttribute(
      'href',
      '/account/pediatrician/visits/v1/remarks',
    )
    expect(screen.getByRole('link', { name: /Remarks/ })).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: /Discussion/ })).toHaveTextContent('0')
  })
})
