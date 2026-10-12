import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deleteAllBabyData, exportBabyData, importBabyData, parseImportFile, serializeBabyExport } from '../lib/babyExport'
import { BOM } from '../lib/csv'
import type { Baby } from '../types/models'

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'deleting' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

/** How long the Blob URL outlives the click: the download reads it asynchronously. */
const DOWNLOAD_URL_LIFETIME_MS = 10_000

function downloadCsvFile(filename: string, contents: string) {
  // The BOM makes Excel read the file as UTF-8 (accents in notes); the import ignores it.
  const blob = new Blob([BOM, contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // Some WebKit versions only honour `download` on a link attached to the document; revoking
  // the URL right after click() can leave Firefox / Safari (PWA) with an empty file.
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    link.remove()
  }, DOWNLOAD_URL_LIFETIME_MS)
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
      const { imported, duplicates, skippedRunning } = await importBabyData(householdId, baby.id, data, user.uid)
      const details = [
        duplicates > 0 ? `${duplicates} already present (ignored)` : null,
        skippedRunning > 0
          ? `${skippedRunning} unfinished ${skippedRunning === 1 ? 'sleep' : 'sleeps'} ignored`
          : null,
        skipped > 0 ? `${skipped} skipped (not supported)` : null,
      ].filter(Boolean)
      const message = `Import complete: ${imported} entries imported${details.map((d) => `, ${d}`).join('')}.`
      setStatus({ kind: 'success', message })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.'
      setStatus({ kind: 'error', message })
    } finally {
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      `Delete all of ${baby.name}'s logged entries? Pediatrician visits and reminders are kept. This cannot be undone.`,
    )
    if (!confirmed) return
    setStatus({ kind: 'deleting' })
    try {
      const deleted = await deleteAllBabyData(householdId, baby.id)
      setStatus({ kind: 'success', message: `${deleted} entries deleted.` })
    } catch {
      setStatus({ kind: 'error', message: 'Delete failed.' })
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
      <p className="hint">Logged entries only: pediatrician visits and reminders are not exported.</p>
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
      <button
        type="button"
        className="settings-action settings-action-danger"
        onClick={() => void handleDeleteAll()}
        disabled={status.kind === 'deleting'}
        aria-describedby="delete-all-data-hint"
      >
        Delete All Data
      </button>
      <p id="delete-all-data-hint" className="hint">
        Deletes every logged entry. Pediatrician visits and reminders are kept.
      </p>
      {status.kind === 'success' && <p role="status">{status.message}</p>}
      {status.kind === 'error' && <p role="alert">{status.message}</p>}
    </section>
  )
}
