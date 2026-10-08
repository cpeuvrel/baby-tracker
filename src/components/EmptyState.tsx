import type { ReactNode } from 'react'
import { BlobIcon } from './BlobIcon'

/** Friendly placeholder for an empty list: a large blob icon over a short message. */
export function EmptyState({ colorVar, icon, children }: { colorVar: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="empty-state">
      <BlobIcon colorVar={colorVar} size="large">
        {icon}
      </BlobIcon>
      <p>{children}</p>
    </div>
  )
}
