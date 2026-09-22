import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { exportBabyData, importBabyData, parseImportFile, serializeBabyExport } from '../lib/babyExport'

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

function downloadCsvFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function countEntries(data: { feedingEntries: unknown[]; sleepEntries: unknown[]; diaperEntries: unknown[]; growthEntries: unknown[]; medicationEntries: unknown[] }) {
  return (
    data.feedingEntries.length +
    data.sleepEntries.length +
    data.diaperEntries.length +
    data.growthEntries.length +
    data.medicationEntries.length
  )
}

export function ExportImportSection() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!household || !selectedBaby || !user) return null

  const handleExport = async () => {
    setStatus({ kind: 'exporting' })
    try {
      const data = await exportBabyData(household.id, selectedBaby)
      downloadCsvFile(`${selectedBaby.name}-export.csv`, serializeBabyExport(data))
      setStatus({ kind: 'success', message: 'Export downloaded.' })
    } catch {
      setStatus({ kind: 'error', message: 'Export failed.' })
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setStatus({ kind: 'importing' })
    try {
      const text = await file.text()
      const { data, skipped } = parseImportFile(text, user.uid)
      await importBabyData(household.id, selectedBaby.id, data)
      const imported = countEntries(data)
      const message =
        skipped > 0
          ? `Import complete: ${imported} entries imported, ${skipped} skipped (not supported).`
          : `Import complete: ${imported} entries imported.`
      setStatus({ kind: 'success', message })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.'
      setStatus({ kind: 'error', message })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <section aria-label="Import / export">
      <h2>Import / export</h2>
      <p>Applies to the currently selected baby: {selectedBaby.name}.</p>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={status.kind === 'exporting'}
      >
        Export data (CSV)
      </button>
      <div>
        <label htmlFor="import-file">Import a CSV file (native or Nara export)</label>
        <input
          id="import-file"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void handleImport(event)}
          disabled={status.kind === 'importing'}
        />
      </div>
      {status.kind === 'success' && <p role="status">{status.message}</p>}
      {status.kind === 'error' && <p role="alert">{status.message}</p>}
    </section>
  )
}
