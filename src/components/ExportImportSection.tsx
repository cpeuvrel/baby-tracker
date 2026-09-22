import { useRef, useState, type ChangeEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { exportBabyData, importBabyData, parseBabyExport, serializeBabyExport } from '../lib/babyExport'

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

function downloadJsonFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ExportImportSection() {
  const { household, selectedBaby } = useHousehold()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!household || !selectedBaby) return null

  const handleExport = async () => {
    setStatus({ kind: 'exporting' })
    try {
      const data = await exportBabyData(household.id, selectedBaby)
      downloadJsonFile(`${selectedBaby.name}-export.json`, serializeBabyExport(data))
      setStatus({ kind: 'success', message: 'Export téléchargé.' })
    } catch {
      setStatus({ kind: 'error', message: "Échec de l'export." })
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setStatus({ kind: 'importing' })
    try {
      const text = await file.text()
      const data = parseBabyExport(text)
      await importBabyData(household.id, selectedBaby.id, data)
      setStatus({ kind: 'success', message: 'Import terminé.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de l'import."
      setStatus({ kind: 'error', message })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <section aria-label="Import / export">
      <h2>Import / export</h2>
      <p>Concerne le bébé actuellement sélectionné : {selectedBaby.name}.</p>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={status.kind === 'exporting'}
      >
        Exporter les données (JSON)
      </button>
      <div>
        <label htmlFor="import-file">Importer un fichier JSON</label>
        <input
          id="import-file"
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={(event) => void handleImport(event)}
          disabled={status.kind === 'importing'}
        />
      </div>
      {status.kind === 'success' && <p role="status">{status.message}</p>}
      {status.kind === 'error' && <p role="alert">{status.message}</p>}
    </section>
  )
}
