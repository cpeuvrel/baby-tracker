import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    // jsdom cannot follow the download link (it logs "Not implemented: navigation").
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
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
    importBabyData.mockResolvedValue({ imported: 2, duplicates: 0, skippedRunning: 0 })
    const user = userEvent.setup()
    const file = new File(['category,at\nfeeding,2026-01-01'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)
    expect(importBabyData).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Import Data' }))

    expect(parseImportFile).toHaveBeenCalledWith(expect.any(String), 'uid1')
    expect(importBabyData).toHaveBeenCalledWith('h1', 'b1', { ...emptyExport, feedingEntries: [{}, {}] }, 'uid1')
    expect(await screen.findByRole('status')).toHaveTextContent('Import complete: 2 entries imported.')
  })

  it('mentions skipped rows in the success message', async () => {
    parseImportFile.mockReturnValue({ data: emptyExport, skipped: 3 })
    importBabyData.mockResolvedValue({ imported: 0, duplicates: 0, skippedRunning: 0 })
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
    importBabyData.mockResolvedValue({ imported: 2, duplicates: 5, skippedRunning: 0 })
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

describe('ExportImportSection download and messages', () => {
  beforeEach(() => {
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

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('downloads the CSV with a BOM from an attached link, and frees it only after a delay', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })
    exportBabyData.mockResolvedValue(emptyExport)
    serializeBabyExport.mockReturnValue('category,at')

    render(<ExportImportSection householdId="h1" baby={baby} />)
    fireEvent.click(screen.getByRole('button', { name: 'Export Data (CSV)' }))
    // vi.waitFor polls with real timers: Testing Library's findBy would wait on the faked ones.
    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Export downloaded.'))

    expect(clicked).toHaveLength(1)
    const [link] = clicked
    expect(link.download).toBe('Léo-export.csv')
    expect(link.href).toBe('blob:mock')
    expect(link.isConnected).toBe(true)
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(10_000)

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    expect(link.isConnected).toBe(false)
  })

  it('reports the unfinished sleeps left out of the import', async () => {
    parseImportFile.mockReturnValue({ data: emptyExport, skipped: 0 })
    importBabyData.mockResolvedValue({ imported: 3, duplicates: 0, skippedRunning: 1 })
    const user = userEvent.setup()
    const file = new File(['category,at'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection householdId="h1" baby={baby} />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)
    await user.click(screen.getByRole('button', { name: 'Import Data' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Import complete: 3 entries imported, 1 unfinished sleep ignored.',
    )
  })

  it('says what the export and Delete All Data leave out', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<ExportImportSection householdId="h1" baby={baby} />)

    expect(screen.getByText(/pediatrician visits and reminders are not exported/)).toBeInTheDocument()
    const deleteButton = screen.getByRole('button', { name: 'Delete All Data' })
    expect(deleteButton).toHaveAccessibleDescription(
      'Deletes every logged entry. Pediatrician visits and reminders are kept.',
    )
    await user.click(deleteButton)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Pediatrician visits and reminders are kept'))
  })
})
