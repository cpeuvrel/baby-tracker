import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import { ExportImportSection } from './ExportImportSection'

const deleteAllBabyData = vi.fn()
const exportBabyData = vi.fn()
const importBabyData = vi.fn()
const parseImportFile = vi.fn()
const serializeBabyExport = vi.fn()

vi.mock('../lib/babyExport', () => ({
  deleteAllBabyData: (...args: unknown[]) => deleteAllBabyData(...args),
  exportBabyData: (...args: unknown[]) => exportBabyData(...args),
  importBabyData: (...args: unknown[]) => importBabyData(...args),
  parseImportFile: (...args: unknown[]) => parseImportFile(...args),
  serializeBabyExport: (...args: unknown[]) => serializeBabyExport(...args),
}))

const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

const emptyExport = {
  feedingEntries: [],
  sleepEntries: [],
  diaperEntries: [],
  growthEntries: [],
  medicationEntries: [],
  bathEntries: [],
}

describe('ExportImportSection', () => {
  beforeEach(() => {
    deleteAllBabyData.mockReset()
    exportBabyData.mockReset()
    importBabyData.mockReset()
    parseImportFile.mockReset()
    serializeBabyExport.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  it('renders nothing without a signed-in user', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })

    const { container } = render(<ExportImportSection householdId="h1" baby={baby} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('exports and downloads a CSV file, then shows a success message', async () => {
    exportBabyData.mockResolvedValue(emptyExport)
    serializeBabyExport.mockReturnValue('category,at\n')
    const user = userEvent.setup()

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.click(screen.getByRole('button', { name: 'Export Data (CSV)' }))

    expect(exportBabyData).toHaveBeenCalledWith('h1', baby)
    expect(await screen.findByRole('status')).toHaveTextContent('Export downloaded.')
  })

  it('shows an error message when the export fails', async () => {
    exportBabyData.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.click(screen.getByRole('button', { name: 'Export Data (CSV)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Export failed.")
  })

  it('disables the Import button until a file is chosen', async () => {
    const user = userEvent.setup()
    const file = new File(['category,at\nfeeding,2026-01-01'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)

    expect(screen.getByRole('button', { name: 'Import Data' })).toBeDisabled()

    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)

    expect(screen.getByRole('button', { name: 'Import Data' })).toBeEnabled()
    expect(importBabyData).not.toHaveBeenCalled()
  })

  it('imports the chosen file only once the Import button is clicked, showing a success message with the entry count', async () => {
    parseImportFile.mockReturnValue({
      data: { ...emptyExport, feedingEntries: [{}, {}] },
      skipped: 0,
    })
    importBabyData.mockResolvedValue({ imported: 2, duplicates: 0 })
    const user = userEvent.setup()
    const file = new File(['category,at\nfeeding,2026-01-01'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)
    expect(importBabyData).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Import Data' }))

    expect(parseImportFile).toHaveBeenCalledWith(expect.any(String), 'uid1')
    expect(importBabyData).toHaveBeenCalledWith('h1', 'b1', { ...emptyExport, feedingEntries: [{}, {}] })
    expect(await screen.findByRole('status')).toHaveTextContent('Import complete: 2 entries imported.')
  })

  it('mentions skipped rows in the success message', async () => {
    parseImportFile.mockReturnValue({ data: emptyExport, skipped: 3 })
    importBabyData.mockResolvedValue({ imported: 0, duplicates: 0 })
    const user = userEvent.setup()
    const file = new File(['Type,...'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)
    await user.click(screen.getByRole('button', { name: 'Import Data' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Import complete: 0 entries imported, 3 skipped',
    )
  })

  it('mentions entries ignored because they already exist', async () => {
    parseImportFile.mockReturnValue({ data: emptyExport, skipped: 1 })
    importBabyData.mockResolvedValue({ imported: 2, duplicates: 5 })
    const user = userEvent.setup()
    const file = new File(['Type,...'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)
    await user.click(screen.getByRole('button', { name: 'Import Data' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Import complete: 2 entries imported, 5 already present (ignored), 1 skipped (not supported).',
    )
  })

  it('shows the parse error message when the file format is invalid', async () => {
    parseImportFile.mockImplementation(() => {
      throw new Error('Unrecognized CSV file format.')
    })
    const user = userEvent.setup()
    const file = new File(['not a csv'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)
    await user.click(screen.getByRole('button', { name: 'Import Data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unrecognized CSV file format')
    expect(importBabyData).not.toHaveBeenCalled()
  })

  it('deletes all data after confirmation and shows how many entries were removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteAllBabyData.mockResolvedValue(12)
    const user = userEvent.setup()

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.click(screen.getByRole('button', { name: 'Delete All Data' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Léo'))
    expect(deleteAllBabyData).toHaveBeenCalledWith('h1', 'b1')
    expect(await screen.findByRole('status')).toHaveTextContent('12 entries deleted.')
  })

  it('deletes nothing when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.click(screen.getByRole('button', { name: 'Delete All Data' }))

    expect(deleteAllBabyData).not.toHaveBeenCalled()
  })

  it('shows an error message when deleting fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteAllBabyData.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.click(screen.getByRole('button', { name: 'Delete All Data' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed.')
  })
})
