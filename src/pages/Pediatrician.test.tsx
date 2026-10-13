import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockHousehold } from '../test/mockContexts'
import type { PediatricianVisit } from '../types/models'
import { PediatricianHistoryPage } from './PediatricianHistoryPage'
import { PediatricianPage } from './PediatricianPage'
import { PediatricianVisitPage } from './PediatricianVisitPage'
import { VisitDiscussionPage } from './VisitDiscussionPage'
import { VisitRemarksPage } from './VisitRemarksPage'

const addPediatricianVisit = vi.fn()
const updatePediatricianVisit = vi.fn()
const mutateVisitItems = vi.fn()
const appendVisitItem = vi.fn()
const deletePediatricianVisit = vi.fn()
let visitsByBaby: Record<string, PediatricianVisit[]> = {}
// 'pending': no snapshot yet; an Error: the listener fails.
let subscriptionOutcome: 'snapshot' | 'pending' | Error = 'snapshot'

vi.mock('../repositories/pediatricianVisits', () => ({
  addPediatricianVisit: (...args: unknown[]) => addPediatricianVisit(...args),
  updatePediatricianVisit: (...args: unknown[]) => updatePediatricianVisit(...args),
  mutateVisitItems: (...args: unknown[]) => mutateVisitItems(...args),
  appendVisitItem: (...args: unknown[]) => appendVisitItem(...args),
  deletePediatricianVisit: (...args: unknown[]) => deletePediatricianVisit(...args),
  subscribeToPediatricianVisits: (
    _h: string,
    babyId: string,
    onChange: (v: PediatricianVisit[]) => void,
    onError: (error: Error) => void,
  ) => {
    if (subscriptionOutcome instanceof Error) onError(subscriptionOutcome)
    else if (subscriptionOutcome === 'snapshot') onChange(visitsByBaby[babyId] ?? [])
    return () => {}
  },
}))

vi.mock('../lib/pushRegistration', () => ({ registerPush: vi.fn().mockResolvedValue(undefined) }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'uid1' } }),
}))

const leo = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }
const mia = { id: 'b2', name: 'Mia', birthDate: '2024-01-01', sex: null }

function visit(overrides: Partial<PediatricianVisit>): PediatricianVisit {
  return {
    id: 'v1',
    date: '2026-10-08',
    vaccinated: false,
    vaccineBought: false,
    remarks: [],
    discussions: [],
    createdBy: 'uid1',
    createdAt: '2026-10-08T10:00:00.000Z',
    ...overrides,
  }
}

const selectBabyMock = vi.fn()

function selectBaby(baby: typeof leo) {
  mockHousehold({ babies: [leo, mia], selectedBaby: baby, selectBaby: selectBabyMock })
}

/**
 * The change last sent for the visit's `field`, applied to `stored`: the list as the server
 * has it, which may hold the other parent's latest changes.
 */
function lastChangeApplied<T>(field: 'remarks' | 'discussions', stored: T[]): T[] {
  const call = mutateVisitItems.mock.lastCall ?? []
  expect(call.slice(0, 4)).toEqual(['h1', 'b1', 'v1', field])
  return (call[4] as (items: T[]) => T[])(stored)
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
        <Route path="/account" element={<p>Family screen</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Pediatrician screens', () => {
  beforeEach(() => {
    addPediatricianVisit.mockReset()
    updatePediatricianVisit.mockReset().mockResolvedValue(undefined)
    mutateVisitItems.mockReset().mockResolvedValue(undefined)
    appendVisitItem.mockReset().mockResolvedValue(undefined)
    deletePediatricianVisit.mockReset().mockResolvedValue(undefined)
    visitsByBaby = {}
    subscriptionOutcome = 'snapshot'
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

  it('closes the new visit popup when created from another visit', async () => {
    const user = userEvent.setup()
    addPediatricianVisit.mockResolvedValue('v9')
    visitsByBaby = { b1: [visit({ id: 'v9', date: '2026-09-30' }), visit({ id: 'v1', date: '2026-07-01' })] }
    renderAt('/account/pediatrician/visits/v1')

    await user.click(screen.getByRole('button', { name: /New Visit/ }))
    const dialog = screen.getByRole('dialog', { name: 'New Visit' })
    // The popup's date field must not share its id with the visit's own date field behind it.
    expect(document.querySelectorAll('#visit-date')).toHaveLength(1)
    expect(within(dialog).getByLabelText('Date')).toHaveAttribute('id', 'new-visit-date')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('heading', { name: 'Wed, Sep 30, 2026' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'New Visit' })).not.toBeInTheDocument()
  })

  it('shows a loading state until the visits arrive', () => {
    subscriptionOutcome = 'pending'
    renderAt('/account/pediatrician')

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('says so when the visits cannot be loaded, with a way back', async () => {
    subscriptionOutcome = new Error('permission-denied')
    const user = userEvent.setup()
    renderAt('/account/pediatrician')

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load the visits (permission-denied).')
    await user.click(screen.getByRole('link', { name: 'Back' }))
    expect(screen.getByText('Family screen')).toBeInTheDocument()
  })

  it('deletes the visit after confirmation and lands on the history', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    visitsByBaby = { b1: [visit({ id: 'v1', date: '2026-07-01' })] }
    renderAt('/account/pediatrician/visits/v1')

    await user.click(screen.getByRole('button', { name: 'Delete visit' }))

    expect(confirm).toHaveBeenCalledWith('Delete this visit, with its remarks and discussion?')
    expect(deletePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1')
    expect(screen.getByRole('region', { name: 'Past' })).toBeInTheDocument()
  })

  it('keeps the visit when the deletion is cancelled', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    visitsByBaby = { b1: [visit({ id: 'v1', date: '2026-07-01' })] }
    renderAt('/account/pediatrician/visits/v1')

    await user.click(screen.getByRole('button', { name: 'Delete visit' }))

    expect(deletePediatricianVisit).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Wed, Jul 1, 2026' })).toBeInTheDocument()
  })

  it('alerts when the visit cannot be deleted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    deletePediatricianVisit.mockRejectedValue(new Error('permission-denied'))
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ id: 'v1' })] }
    renderAt('/account/pediatrician/visits/v1')

    await user.click(screen.getByRole('button', { name: 'Delete visit' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete this visit.'))
  })

  it('moves the visit to another date, ignoring a cleared field', () => {
    visitsByBaby = { b1: [visit({ id: 'v1', date: '2026-10-08' })] }
    renderAt('/account/pediatrician/visits/v1')

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    expect(updatePediatricianVisit).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-15' } })
    expect(updatePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1', { date: '2026-10-15' })
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
    expect(hrefs('Upcoming')).toEqual(['v2', 'v3', 'v4'])
    expect(hrefs('Past')).toEqual(['v1'])
  })

  it('leaves a visit that does not belong to the selected child', () => {
    visitsByBaby = { b1: [visit({ id: 'v1' })] }
    selectBaby(mia)
    renderAt('/account/pediatrician/visits/v1')

    expect(screen.getByText(/No visits yet/)).toBeInTheDocument()
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

  it('opens a visit planned for today', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00.000Z'))
    visitsByBaby = { b1: [visit({ id: 'v2', date: '2026-11-02' }), visit({ id: 'v1', date: '2026-10-08' })] }
    renderAt('/account/pediatrician')
    vi.useRealTimers()

    expect(screen.getByRole('heading', { name: 'Thu, Oct 8, 2026' })).toBeInTheDocument()
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

    expect(mutateVisitItems).toHaveBeenCalledTimes(1)
    // Only this remark changes: one added meanwhile on the other phone stays.
    expect(
      lastChangeApplied('remarks', [
        { id: 'r1', text: 'Good weight' },
        { id: 'r2', text: 'From the other phone' },
      ]),
    ).toEqual([
      { id: 'r1', text: 'Good weight!' },
      { id: 'r2', text: 'From the other phone' },
    ])
    expect(updatePediatricianVisit).not.toHaveBeenCalled()
  })

  it('alerts when the edits saved on leaving the screen could not be kept', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mutateVisitItems.mockRejectedValue(new Error('unavailable'))
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }] })] }
    const { unmount } = renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Good weight' }))
    await user.type(screen.getByRole('textbox', { name: 'Remark' }), '!')
    unmount()

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Good weight!')))
  })

  it('adds a remark', async () => {
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }] })] }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Add remark' }))
    await user.type(screen.getByRole('textbox', { name: 'Remark' }), '  Next visit in 2 months ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Added with an array union (queued offline, merged server-side), not a transaction.
    expect(appendVisitItem).toHaveBeenCalledWith('h1', 'b1', 'v1', 'remarks', {
      id: expect.any(String),
      text: 'Next visit in 2 months',
    })
    expect(mutateVisitItems).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the editor open with an error when the remark cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    appendVisitItem.mockRejectedValue(new Error('unavailable'))
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({})] }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Add remark' }))
    await user.type(screen.getByRole('textbox', { name: 'Remark' }), 'Next visit in 2 months')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.')
    expect(screen.getByRole('textbox', { name: 'Remark' })).toHaveValue('Next visit in 2 months')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('deletes a remark after confirmation, leaving the others', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    visitsByBaby = {
      b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }, { id: 'r2', text: 'Next visit' }] })],
    }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Good weight' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(confirm).toHaveBeenCalledWith('Delete this entry?')
    expect(
      lastChangeApplied('remarks', [
        { id: 'r1', text: 'Good weight' },
        { id: 'r2', text: 'Next visit' },
        { id: 'r3', text: 'From the other phone' },
      ]),
    ).toEqual([
      { id: 'r2', text: 'Next visit' },
      { id: 'r3', text: 'From the other phone' },
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the editor open with an error when the remark cannot be deleted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mutateVisitItems.mockRejectedValue(new Error('unavailable'))
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ remarks: [{ id: 'r1', text: 'Good weight' }] })] }
    renderAt('/account/pediatrician/visits/v1/remarks')

    await user.click(screen.getByRole('button', { name: 'Good weight' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
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
    expect(mutateVisitItems).not.toHaveBeenCalled()
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

    expect(
      lastChangeApplied('discussions', [
        { id: 'd1', question: 'Vitamin D?', answer: '' },
        { id: 'd2', question: 'From the other phone', answer: '' },
      ]),
    ).toEqual([
      { id: 'd1', question: 'Vitamin D?', answer: 'Until 18 months' },
      { id: 'd2', question: 'From the other phone', answer: '' },
    ])
  })

  it('adds a question', async () => {
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({})] }
    renderAt('/account/pediatrician/visits/v1/discussion')

    await user.click(screen.getByRole('button', { name: 'Add question' }))
    await user.type(screen.getByRole('textbox', { name: 'Question' }), 'Vitamin D?')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(appendVisitItem).toHaveBeenCalledWith('h1', 'b1', 'v1', 'discussions', {
      id: expect.any(String),
      question: 'Vitamin D?',
      answer: '',
    })
    expect(mutateVisitItems).not.toHaveBeenCalled()
  })

  it('deletes a question after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    visitsByBaby = { b1: [visit({ discussions: [{ id: 'd1', question: 'Vitamin D?', answer: '' }] })] }
    renderAt('/account/pediatrician/visits/v1/discussion')

    await user.click(screen.getByRole('button', { name: /Vitamin D\?/ }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      lastChangeApplied('discussions', [
        { id: 'd1', question: 'Vitamin D?', answer: '' },
        { id: 'd2', question: 'From the other phone', answer: '' },
      ]),
    ).toEqual([{ id: 'd2', question: 'From the other phone', answer: '' }])
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
  it('asks whether the vaccine was bought only when one is planned', async () => {
    const user = userEvent.setup()
    visitsByBaby = { b1: [visit({ vaccinated: true })] }
    renderAt('/account/pediatrician/visits/v1')

    const bought = screen.getByRole('group', { name: 'Vaccine bought' })
    expect(screen.getByText(/Reminder at noon/)).toBeInTheDocument()
    await user.click(within(bought).getByRole('button', { name: 'Yes' }))

    expect(updatePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1', { vaccineBought: true })
  })

  it('hides the purchase question for a visit without vaccine', () => {
    visitsByBaby = { b1: [visit({ vaccinated: false })] }
    renderAt('/account/pediatrician/visits/v1')

    expect(screen.queryByRole('group', { name: 'Vaccine bought' })).not.toBeInTheDocument()
  })

  it('records the purchase from the notification’s “Yes”', async () => {
    visitsByBaby = { b1: [visit({ vaccinated: true })] }
    renderAt('/account/pediatrician/visits/v1?baby=b1&vaccineBought=yes')

    await vi.waitFor(() =>
      expect(updatePediatricianVisit).toHaveBeenCalledWith('h1', 'b1', 'v1', { vaccineBought: true }),
    )
    expect(updatePediatricianVisit).toHaveBeenCalledTimes(1)
  })

  it('selects the notification’s child instead of leaving its visit', () => {
    selectBabyMock.mockReset()
    visitsByBaby = { b2: [visit({ id: 'v7' })] }
    renderAt('/account/pediatrician/visits/v7?baby=b2')

    expect(selectBabyMock).toHaveBeenCalledWith('b2')
    expect(screen.queryByText(/No visits yet/)).not.toBeInTheDocument()
  })
})
