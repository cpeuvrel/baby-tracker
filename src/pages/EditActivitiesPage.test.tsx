import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { EditActivitiesPage } from './EditActivitiesPage'
import { mockHousehold } from '../test/mockContexts'

function renderPage(babyId = 'b1') {
  return render(
    <MemoryRouter initialEntries={[`/account/family/${babyId}/activities`]}>
      <Routes>
        <Route path="/account/family/:babyId/activities" element={<EditActivitiesPage />} />
        <Route path="/account/family" element={<p>Children list</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EditActivitiesPage', () => {
  beforeEach(() => {
    localStorage.clear()
    mockHousehold()
  })

  it('redirects to the children list when the baby cannot be found', () => {
    renderPage('unknown')

    expect(screen.getByText('Children list')).toBeInTheDocument()
  })

  it('lists only the categories tracked by this app, all checked by default', () => {
    renderPage()

    expect(screen.getByLabelText('Feeding')).toBeChecked()
    expect(screen.getByLabelText('Sleep')).toBeChecked()
    expect(screen.getByLabelText('Diaper Changes')).toBeChecked()
    expect(screen.getByLabelText('Growth')).toBeChecked()
    expect(screen.getByLabelText('Routine (bath, vitamin)')).toBeChecked()
  })

  it('unchecks a category and persists it', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByLabelText('Growth'))

    expect(screen.getByLabelText('Growth')).not.toBeChecked()
    expect(JSON.parse(localStorage.getItem('baby-tracker:hiddenActivities') ?? '[]')).toEqual(['growth'])
  })

  it('says the setting stays on this device', () => {
    renderPage()

    expect(screen.getByText(/This setting is saved on this device only\./)).toBeInTheDocument()
  })
})
