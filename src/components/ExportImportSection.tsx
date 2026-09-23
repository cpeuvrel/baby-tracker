import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { exportBabyData, importBabyData, parseImportFile, serializeBabyExport } from '../lib/babyExport'
import type { Baby } from '../types/models'

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

interface ExportImportSectionProps {
  householdId: string
  baby: Baby
}

export function ExportImportSection({ householdId, baby }: ExportImportSectionProps) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  const handleExport = async () => {
    setStatus({ kind: 'exporting' })
    try {
      const data = await exportBabyData(householdId, baby)
      downloadCsvFile(`${baby.name}-export.csv`, serializeBabyExport(data))
      setStatus({ kind: 'success', message: 'Export downloaded.' })
    } catch {
      setStatus({ kind: 'error', message: 'Export failed.' })
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null)
    setStatus({ kind: 'idle' })
  }

  const handleImport = async () => {
    if (!selectedFile || !user) return
    setStatus({ kind: 'importing' })
    try {
      const text = await selectedFile.text()
      const { data, skipped } = parseImportFile(text, user.uid)
      await importBabyData(householdId, baby.id, data)
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
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <section aria-label="Import / export">
      <h2>Import / export</h2>
      <button
        type="button"
        className="settings-action"
        onClick={() => void handleExport()}
        disabled={status.kind === 'exporting'}
      >
        Export Data (CSV)
      </button>
      <div>
        <label htmlFor="import-file">Import a CSV file (native or Nara export)</label>
        <input
          id="import-file"
          ref={fileInputRef}
          className="settings-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={status.kind === 'importing'}
        />
        <button
          type="button"
          className="settings-action"
          onClick={() => void handleImport()}
          disabled={!selectedFile || status.kind === 'importing'}
        >
          Import Data
        </button>
      </div>
      {status.kind === 'success' && <p role="status">{status.message}</p>}
      {status.kind === 'error' && <p role="alert">{status.message}</p>}
    </section>
  )
}
