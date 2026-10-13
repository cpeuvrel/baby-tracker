import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { GrowthEntry } from '../types/models'
import { GrowthForm } from './GrowthForm'

const addGrowthEntry = vi.fn()
const updateGrowthEntry = vi.fn()
const deleteGrowthEntry = vi.fn()

vi.mock('../repositories/growthEntries', () => ({
  addGrowthEntry: (...args: unknown[]) => addGrowthEntry(...args),
  updateGrowthEntry: (...args: unknown[]) => updateGrowthEntry(...args),
  deleteGrowthEntry: (...args: unknown[]) => deleteGrowthEntry(...args),
}))

const entry: GrowthEntry = {
  id: 'g1',
  measuredAt: '2026-03-05T10:00:00.000Z',
  weightG: 6200,
  heightMm: 620,
  headCircumferenceMm: null,
  notes: 'fasting',
  createdBy: 'uid1',
  createdAt: '2026-03-05T10:00:00.000Z',
}

describe('GrowthForm', () => {
  beforeEach(() => {
    addGrowthEntry.mockReset().mockResolvedValue(undefined)
    updateGrowthEntry.mockReset().mockResolvedValue(undefined)
    deleteGrowthEntry.mockReset().mockResolvedValue(undefined)
    localStorage.clear()
    mockAuth()
    mockHousehold()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits a growth measurement converted to grams and millimeters, then calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm onClose={onClose} />)
    await user.type(screen.getByLabelText('Weight (kg)'), '6.2')
    await user.type(screen.getByLabelText('Height (cm)'), '62')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addGrowthEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ weightG: 6200, heightMm: 620, headCircumferenceMm: null }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('converts from pounds and inches when the imperial unit is preferred', async () => {
    localStorage.setItem('baby-tracker:unitSystem', 'imperial')
    const user = userEvent.setup()

    render(<GrowthForm onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Weight (lb)'), '10')
    await user.type(screen.getByLabelText('Height (in)'), '20')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addGrowthEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ weightG: 4536, heightMm: 508 }),
    )
  })

  it('prefills the form from an existing entry, converted back to display units, and updates it', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm entry={entry} onClose={onClose} />)

    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.2)
    expect(screen.getByLabelText('Height (cm)')).toHaveValue(62)
    expect(screen.getByDisplayValue('fasting')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateGrowthEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'g1',
      expect.objectContaining({ weightG: 6200, heightMm: 620, notes: 'fasting' }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(addGrowthEntry).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<GrowthForm entry={entry} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteGrowthEntry).toHaveBeenCalledWith('h1', 'b1', 'g1')
    expect(onClose).toHaveBeenCalled()
  })

  it.each(['0', '-1'])('refuses a weight of %s with a message under the field', async (weight) => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm onClose={onClose} />)
    await user.type(screen.getByLabelText('Weight (kg)'), weight)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addGrowthEntry).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value above 0')
  })

  it('asks before saving an implausible value, and saves only once confirmed', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm onClose={onClose} />)
    // Grams typed in the kilogram field.
    await user.type(screen.getByLabelText('Weight (kg)'), '6200')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(confirm).toHaveBeenCalledWith('Weight (kg): 6200 looks unusual. Save anyway?')
    expect(addGrowthEntry).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addGrowthEntry).toHaveBeenCalledWith('h1', 'b1', 'uid1', expect.objectContaining({ weightG: 6_200_000 }))
  })

  it('does not ask for a plausible measurement', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()

    render(<GrowthForm onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Weight (kg)'), '3.4')
    await user.type(screen.getByLabelText('Head Size (cm)'), '35')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(addGrowthEntry).toHaveBeenCalledTimes(1)
  })

  it('prefills a weight to the gram without float noise, and the browser accepts it', async () => {
    const user = userEvent.setup()

    render(<GrowthForm entry={{ ...entry, weightG: 6235 }} onClose={vi.fn()} />)
    const weight = screen.getByLabelText('Weight (kg)')
    expect(weight).toHaveValue(6.235)
    // No step mismatch: Save (and Enter) are not blocked by the native validation.
    expect(weight).toBeValid()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateGrowthEntry).toHaveBeenCalledWith('h1', 'b1', 'g1', expect.objectContaining({ weightG: 6235 }))
  })

  it('prefills imperial values rounded to two decimals', () => {
    localStorage.setItem('baby-tracker:unitSystem', 'imperial')

    render(<GrowthForm entry={{ ...entry, weightG: 4536 }} onClose={vi.fn()} />)

    expect(screen.getByLabelText('Weight (lb)')).toHaveValue(10)
    expect(screen.getByLabelText('Height (in)')).toHaveValue(24.41)
  })

  it('tells the user when the save is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateGrowthEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<GrowthForm entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Could not save the measurement. Please try again.'),
    )
  })

  it('tells the user when the delete is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteGrowthEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<GrowthForm entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Could not delete the measurement. Please try again.'),
    )
  })
})
