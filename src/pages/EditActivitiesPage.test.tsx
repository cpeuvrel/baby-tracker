import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { EditActivitiesPage } from './EditActivitiesPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account/family/b1/activities']}>
      <Routes>
        <Route path="/account/family/:babyId/activities" element={<EditActivitiesPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EditActivitiesPage', () => {
  beforeEach(() => {
    localStorage.clear()
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
})
