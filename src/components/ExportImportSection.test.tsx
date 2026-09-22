import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { ExportImportSection } from './ExportImportSection'

const exportBabyData = vi.fn()
const importBabyData = vi.fn()
const parseBabyExport = vi.fn()
const serializeBabyExport = vi.fn()

vi.mock('../lib/babyExport', () => ({
  exportBabyData: (...args: unknown[]) => exportBabyData(...args),
  importBabyData: (...args: unknown[]) => importBabyData(...args),
  parseBabyExport: (...args: unknown[]) => parseBabyExport(...args),
  serializeBabyExport: (...args: unknown[]) => serializeBabyExport(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('ExportImportSection', () => {
  beforeEach(() => {
    exportBabyData.mockReset()
    importBabyData.mockReset()
    parseBabyExport.mockReset()
    serializeBabyExport.mockReset()
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

  it('exports and downloads a JSON file, then shows a success message', async () => {
    exportBabyData.mockResolvedValue({ formatVersion: 1 })
    serializeBabyExport.mockReturnValue('{"formatVersion":1}')
    const user = userEvent.setup()

    render(<ExportImportSection />)
    await user.click(screen.getByRole('button', { name: 'Exporter les données (JSON)' }))

    expect(exportBabyData).toHaveBeenCalledWith('h1', baby)
    expect(await screen.findByRole('status')).toHaveTextContent('Export téléchargé.')
  })

  it('shows an error message when the export fails', async () => {
    exportBabyData.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()

    render(<ExportImportSection />)
    await user.click(screen.getByRole('button', { name: 'Exporter les données (JSON)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Échec de l'export.")
  })

  it('imports the uploaded file and shows a success message', async () => {
    parseBabyExport.mockReturnValue({ formatVersion: 1 })
    importBabyData.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const file = new File(['{"formatVersion":1}'], 'export.json', { type: 'application/json' })

    render(<ExportImportSection />)
    await user.upload(screen.getByLabelText('Importer un fichier JSON'), file)

    expect(importBabyData).toHaveBeenCalledWith('h1', 'b1', { formatVersion: 1 })
    expect(await screen.findByRole('status')).toHaveTextContent('Import terminé.')
  })

  it('shows the parse error message when the file format is invalid', async () => {
    parseBabyExport.mockImplementation(() => {
      throw new Error("Format d'export non reconnu ou version incompatible.")
    })
    const user = userEvent.setup()
    const file = new File(['not json'], 'export.json', { type: 'application/json' })

    render(<ExportImportSection />)
    await user.upload(screen.getByLabelText('Importer un fichier JSON'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent("Format d'export non reconnu")
    expect(importBabyData).not.toHaveBeenCalled()
  })
})
