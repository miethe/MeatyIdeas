import * as React from 'react'

import { FileTag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type TagChipProps = {
  tag: FileTag
  onClick?: (tag: FileTag) => void
  interactive?: boolean
  className?: string
  maxWidth?: number
}

function hexToRgb(value: string | null | undefined) {
  if (!value) return null
  const hex = value.trim().replace('#', '')
  const normalized = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex
  if (normalized.length !== 6) return null
  const intVal = Number.parseInt(normalized, 16)
  if (Number.isNaN(intVal)) return null
  const r = (intVal >> 16) & 255
  const g = (intVal >> 8) & 255
  const b = intVal & 255
  return { r, g, b }
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b].map((val) => {
    const channel = val / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

function computeChipColors(color: string | null | undefined) {
  const rgb = hexToRgb(color)
  if (!rgb) {
    return {
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
      borderColor: 'transparent',
    }
  }
  const lum = luminance(rgb)
  const textColor = lum > 0.65 ? 'var(--foreground)' : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
  const backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`
  return { backgroundColor, color: textColor, borderColor }
}

export function TagChip({ tag, onClick, interactive = false, className, maxWidth }: TagChipProps) {
  const { backgroundColor, color, borderColor } = React.useMemo(() => computeChipColors(tag.color), [tag.color])
  const Component = interactive ? 'button' : 'span'

  const chip = (
    <Component
      type={interactive ? 'button' : undefined}
      className={cn(
        'group inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] font-medium leading-tight shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        interactive && 'cursor-pointer hover:opacity-90',
        className
      )}
      style={{ backgroundColor, color, borderColor, maxWidth }}
      onClick={interactive ? () => onClick?.(tag) : undefined}
    >
      {tag.emoji ? (
        <span aria-hidden className="text-sm leading-none">{tag.emoji}</span>
      ) : null}
      <span className="truncate">{tag.label}</span>
    </Component>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="top" align="start">
        <div className="flex flex-col text-xs">
          <span className="font-semibold">{tag.label}</span>
          <span className="text-muted-foreground">#{tag.slug}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

type OverflowTagChipProps = {
  overflow: FileTag[]
  className?: string
}

export function OverflowTagChip({ overflow, className }: OverflowTagChipProps) {
  if (!overflow.length) return null
  const label = `+${overflow.length}`
  const content = (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-dashed px-2 py-[2px] text-[11px] font-medium text-muted-foreground',
        className
      )}
    >
      {label}
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top" align="start">
        <div className="max-h-40 w-48 overflow-auto text-xs">
          <div className="mb-1 font-semibold text-foreground">Additional tags</div>
          <ul className="space-y-1">
            {overflow.map((tag) => (
              <li key={tag.slug} className="truncate text-muted-foreground">
                {tag.emoji ? `${tag.emoji} ` : ''}
                {tag.label}
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
