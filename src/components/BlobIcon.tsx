import type { ReactNode } from 'react'

/** A line icon drawn over a soft blob of a category color (reference app's illustrations). */
export function BlobIcon({
  colorVar,
  size = 'medium',
  children,
}: {
  colorVar: string
  size?: 'small' | 'medium' | 'large'
  children: ReactNode
}) {
  return (
    <span className={`blob-icon blob-icon-${size}`} style={{ ['--blob-color' as string]: `var(${colorVar})` }}>
      {children}
    </span>
  )
}
