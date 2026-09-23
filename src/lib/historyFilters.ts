export type EntryKind = 'sleep' | 'feeding' | 'diaper' | 'medication'

export interface KindOption {
  kind: EntryKind
  label: string
  colorVar: string
}

export const KIND_OPTIONS: KindOption[] = [
  { kind: 'sleep', label: 'Sleep', colorVar: '--category-sleep' },
  { kind: 'feeding', label: 'Feed', colorVar: '--category-feeding' },
  { kind: 'diaper', label: 'Diaper', colorVar: '--category-diaper' },
  { kind: 'medication', label: 'Medication', colorVar: '--category-medication' },
]

export const ALL_ENTRY_KINDS: Set<EntryKind> = new Set(KIND_OPTIONS.map((option) => option.kind))
