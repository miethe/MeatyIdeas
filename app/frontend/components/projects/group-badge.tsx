"use client"

import React from 'react'

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(99, 102, 241, ${alpha})`
  let normalized = hex.trim()
  if (normalized.startsWith('#')) normalized = normalized.slice(1)
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((ch) => ch + ch)
      .join('')
  }
  if (normalized.length !== 6) return `rgba(99, 102, 241, ${alpha})`
  const int = parseInt(normalized, 16)
  if (Number.isNaN(int)) return `rgba(99, 102, 241, ${alpha})`
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function GroupBadge({ name, color }: { name: string; color?: string | null }) {
  const style = React.useMemo(() => {
    if (!color) {
      return {
        backgroundColor: 'var(--muted)',
        borderColor: 'var(--border)',
      }
    }
    return {
      backgroundColor: hexToRgba(color, 0.18),
      borderColor: color,
      color,
    }
  }, [color])

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={style}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color || 'var(--primary)' }} />
      <span className="truncate">{name}</span>
    </span>
  )
}
