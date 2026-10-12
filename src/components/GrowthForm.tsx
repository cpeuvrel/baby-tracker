import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { GRAMS_PER_POUND, MM_PER_INCH } from '../lib/growthMetrics'
import { parseOptionalPositive } from '../lib/numberInput'
import { reportWriteError } from '../lib/reportWriteError'
import { addGrowthEntry, deleteGrowthEntry, updateGrowthEntry } from '../repositories/growthEntries'
import type { GrowthEntry } from '../types/models'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

const FORM_ID = 'growth-form'

type Measure = 'weight' | 'height' | 'head'

/** Plausible range of each measure for a baby or toddler, in grams or millimeters. */
const PLAUSIBLE: Record<Measure, { min: number; max: number }> = {
  weight: { min: 300, max: 30_000 },
  height: { min: 200, max: 1300 },
  head: { min: 200, max: 600 },
}

/** A stored measure in display units, without float noise (6235 g → "6.235", not 6.234999…). */
function formatMeasure(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)))
}

interface GrowthFormProps {
  entry?: GrowthEntry
  onClose: () => void
}

export function GrowthForm({ entry, onClose }: GrowthFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [unit] = useUnitPreference()
  const imperial = unit === 'imperial'
  const weightUnitToGrams = imperial ? GRAMS_PER_POUND : 1000
  const lengthUnitToMm = imperial ? MM_PER_INCH : 10
  // Enough decimals to give back the stored gram or millimeter.
  const weightDecimals = imperial ? 2 : 3
  const lengthDecimals = imperial ? 2 : 1
  const [measuredAt, setMeasuredAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.measuredAt) : new Date()),
  )
  const [weight, setWeight] = useState(
    entry?.weightG != null ? formatMeasure(entry.weightG / weightUnitToGrams, weightDecimals) : '',
  )
  const [height, setHeight] = useState(
    entry?.heightMm != null ? formatMeasure(entry.heightMm / lengthUnitToMm, lengthDecimals) : '',
  )
  const [headCircumference, setHeadCircumference] = useState(
    entry?.headCircumferenceMm != null
      ? formatMeasure(entry.headCircumferenceMm / lengthUnitToMm, lengthDecimals)
      : '',
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [invalid, setInvalid] = useState<Record<Measure, boolean>>({ weight: false, height: false, head: false })

  if (!household || !selectedBaby || !user) return null

  const weightLabel = imperial ? 'Weight (lb)' : 'Weight (kg)'
  const heightLabel = imperial ? 'Height (in)' : 'Height (cm)'
  const headLabel = imperial ? 'Head Size (in)' : 'Head Size (cm)'

  const submit = () => {
    if (!measuredAt) return
    const parsed = {
      weight: parseOptionalPositive(weight),
      height: parseOptionalPositive(height),
      head: parseOptionalPositive(headCircumference),
    }
    const nextInvalid = {
      weight: parsed.weight === 'invalid',
      height: parsed.height === 'invalid',
      head: parsed.head === 'invalid',
    }
    setInvalid(nextInvalid)
    if (nextInvalid.weight || nextInvalid.height || nextInvalid.head) return

    const toStored = (value: number | null | 'invalid', perUnit: number) =>
      typeof value === 'number' ? Math.round(value * perUnit) : null
    const input = {
      measuredAt: fromDatetimeLocalValue(measuredAt),
      weightG: toStored(parsed.weight, weightUnitToGrams),
      heightMm: toStored(parsed.height, lengthUnitToMm),
      headCircumferenceMm: toStored(parsed.head, lengthUnitToMm),
      notes,
    }

    // A unit slip (6200 typed in kg) is saved only once confirmed.
    const unusual = [
      { label: weightLabel, text: weight, stored: input.weightG, range: PLAUSIBLE.weight },
      { label: heightLabel, text: height, stored: input.heightMm, range: PLAUSIBLE.height },
      { label: headLabel, text: headCircumference, stored: input.headCircumferenceMm, range: PLAUSIBLE.head },
    ].filter(({ stored, range }) => stored != null && (stored < range.min || stored > range.max))
    if (
      unusual.length > 0 &&
      !window.confirm(
        `${unusual.map(({ label, text }) => `${label}: ${text.trim()}`).join(', ')} looks unusual. Save anyway?`,
      )
    ) {
      return
    }

    if (entry) {
      updateGrowthEntry(household.id, selectedBaby.id, entry.id, input).catch(reportWriteError('save the measurement'))
    } else {
      addGrowthEntry(household.id, selectedBaby.id, user.uid, input).catch(reportWriteError('save the measurement'))
    }
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Delete this entry?')) return
    deleteGrowthEntry(household.id, selectedBaby.id, entry.id).catch(reportWriteError('delete the measurement'))
    onClose()
  }

  const measureField = (
    measure: Measure,
    id: string,
    label: string,
    value: string,
    setValue: (value: string) => void,
    step: string,
  ) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        step={step}
        min="0"
        value={value}
        aria-invalid={invalid[measure] || undefined}
        // The browser refuses a negative before onSubmit: say why under the field.
        onInvalid={() => setInvalid((current) => ({ ...current, [measure]: true }))}
        onChange={(event) => {
          setValue(event.target.value)
          setInvalid((current) => ({ ...current, [measure]: false }))
        }}
      />
      {invalid[measure] && (
        <p role="alert" className="form-error">
          Enter a value above 0, or leave it empty.
        </p>
      )}
    </div>
  )

  return (
    <Modal
      title="Growth"
      bandColorVar="--category-growth"
      onClose={onClose}
      headerAction={{ label: 'Save', formId: FORM_ID }}
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <DateTimeField id="growth-measured-at" label="Time" value={measuredAt} onChange={setMeasuredAt} />
        {!measuredAt && (
          <p role="alert" className="form-error">
            Pick a date.
          </p>
        )}
        {/* Any decimal: a weight to the gram, or any converted imperial value, must not block Save. */}
        {measureField('weight', 'growth-weight', weightLabel, weight, setWeight, 'any')}
        {measureField('height', 'growth-height', heightLabel, height, setHeight, imperial ? 'any' : '0.1')}
        {measureField('head', 'growth-head', headLabel, headCircumference, setHeadCircumference, imperial ? 'any' : '0.1')}
        <div>
          <label htmlFor="growth-notes">Notes (optional)</label>
          <input
            id="growth-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {entry && (
          <button type="button" className="button-delete" onClick={handleDelete}>
            Delete
          </button>
        )}
      </form>
    </Modal>
  )
}
