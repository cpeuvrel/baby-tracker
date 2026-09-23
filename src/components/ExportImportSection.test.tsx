import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { ExportImportSection } from './ExportImportSection'

const exportBabyData = vi.fn()
const importBabyData = vi.fn()
const parseImportFile = vi.fn()
const serializeBabyExport = vi.fn()

vi.mock('../lib/babyExport', () => ({
  exportBabyData: (...args: unknown[]) => exportBabyData(...args),
  importBabyData: (...args: unknown[]) => importBabyData(...args),
  parseImportFile: (...args: unknown[]) => parseImportFile(...args),
  serializeBabyExport: (...args: unknown[]) => serializeBabyExport(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

const emptyExport = {
  feedingEntries: [],
  sleepEntries: [],
  diaperEntries: [],
  growthEntries: [],
  medicationEntries: [],
}

describe('ExportImportSection', () => {
  beforeEach(() => {
    exportBabyData.mockReset()
    importBabyData.mockReset()
    parseImportFile.mockReset()
    serializeBabyExport.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      error: null,
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
    })
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  it('renders nothing without a resolved household and baby', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = render(<ExportImportSection />)

    expect(container).toBeEmptyDOMElement()
  })

  it('exports and downloads a CSV file, then shows a success message', async () => {
    exportBabyData.mockResolvedValue(emptyExport)
    serializeBabyExport.mockReturnValue('category,at\n')
    const user = userEvent.setup()

    render(<ExportImportSection />)
    await user.click(screen.getByRole('button', { name: 'Export data (CSV)' }))

    expect(exportBabyData).toHaveBeenCalledWith('h1', baby)
    expect(await screen.findByRole('status')).toHaveTextContent('Export downloaded.')
  })

  it('shows an error message when the export fails', async () => {
    exportBabyData.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<ExportImportSection />)
    await user.click(screen.getByRole('button', { name: 'Export data (CSV)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Export failed.")
  })

  it('imports the uploaded file and shows a success message with the entry count', async () => {
    parseImportFile.mockReturnValue({
      data: { ...emptyExport, feedingEntries: [{}, {}] },
      skipped: 0,
    })
    importBabyData.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const file = new File(['category,at\nfeeding,2026-01-01'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)

    expect(parseImportFile).toHaveBeenCalledWith(expect.any(String), 'uid1')
    expect(importBabyData).toHaveBeenCalledWith('h1', 'b1', { ...emptyExport, feedingEntries: [{}, {}] })
    expect(await screen.findByRole('status')).toHaveTextContent('Import complete: 2 entries imported.')
  })

  it('mentions skipped rows in the success message', async () => {
    parseImportFile.mockReturnValue({ data: emptyExport, skipped: 3 })
    importBabyData.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const file = new File(['Type,...'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Import complete: 0 entries imported, 3 skipped',
    )
  })

  it('shows the parse error message when the file format is invalid', async () => {
    parseImportFile.mockImplementation(() => {
      throw new Error('Unrecognized CSV file format.')
    })
    const user = userEvent.setup()
    const file = new File(['not a csv'], 'export.csv', { type: 'text/csv' })

    render(<ExportImportSection />)
    await user.upload(screen.getByLabelText('Import a CSV file (native or Nara export)'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('Unrecognized CSV file format')
    expect(importBabyData).not.toHaveBeenCalled()
  })
})
