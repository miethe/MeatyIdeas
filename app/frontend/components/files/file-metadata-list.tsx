"use client"

import * as React from 'react'

import { MetadataField } from '@/lib/types'
import { cn } from '@/lib/utils'

export type FileMetadataListProps = {
  fields: MetadataField[]
  maxVisible?: number
  className?: string
  dense?: boolean
}

export function FileMetadataList({ fields, maxVisible, className, dense = false }: FileMetadataListProps) {
  if (!fields || fields.length === 0) return null
  const visible = fields.slice(0, maxVisible ?? fields.length)
  const remaining = fields.length - visible.length

  return (
    <dl className={cn('space-y-1 text-xs', dense && 'space-y-0.5', className)}>
      {visible.map((field) => {
        const formatted = formatMetadataValue(field)
        return (
          <div key={field.key} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 font-medium text-muted-foreground">{field.label}</dt>
            <dd className="truncate font-medium text-foreground" title={field.value}>
              {formatted}
            </dd>
          </div>
        )
      })}
      {remaining > 0 && <div className="text-[11px] text-muted-foreground/80">+{remaining} more</div>}
    </dl>
  )
}

function formatMetadataValue(field: MetadataField): string {
  if (field.kind === 'date') {
    const parsed = new Date(field.value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }
  }
  return field.value
}
