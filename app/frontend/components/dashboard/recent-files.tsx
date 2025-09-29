"use client"

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, ExternalLink, Eye, FileText } from 'lucide-react'

import { apiGet } from '@/lib/apiClient'
import { RecentFileEntry, RecentFilesResponseSchema } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/skeleton'

type DashboardRecentFilesProps = {
  onOpen: (file: RecentFileEntry) => void
  onPeek: (file: RecentFileEntry) => void
}

function formatRelativeTime(value: string) {
  try {
    const date = new Date(value)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const minute = 60 * 1_000
    const hour = 60 * minute
    const day = 24 * hour
    if (Math.abs(diffMs) < minute) return 'Just now'
    if (Math.abs(diffMs) < hour) {
      const mins = Math.round(diffMs / minute)
      return `${mins} min${mins === 1 ? '' : 's'} ago`
    }
    if (Math.abs(diffMs) < day) {
      const hrs = Math.round(diffMs / hour)
      return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
    }
    const days = Math.round(diffMs / day)
    if (days <= 7) {
      return `${days} day${days === 1 ? '' : 's'} ago`
    }
    return date.toLocaleDateString()
  } catch {
    return value
  }
}

export function DashboardRecentFiles({ onOpen, onPeek }: DashboardRecentFilesProps) {
  const query = useQuery({
    queryKey: ['recent-files'],
    queryFn: async () => {
      const payload = await apiGet(`/files/recent?limit=5`)
      return RecentFilesResponseSchema.parse(payload)
    },
    staleTime: 30_000,
  })

  const items = query.data?.items || []
  const isLoading = query.isLoading

  return (
    <div className="w-full max-w-sm rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Recent Files
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-[72px] rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">Unable to load recent files right now.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent edits yet. Work on a file and it will appear here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((file) => (
            <li
              key={file.id}
              className="group rounded-lg border border-transparent bg-muted/30 p-3 transition hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{file.project.name}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(file.updated_at)}
                </span>
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">{file.title}</div>
              {file.summary && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{file.summary}</p>
              )}
              {file.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {file.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
                      #{tag}
                    </span>
                  ))}
                  {file.tags.length > 3 && (
                    <span className="text-[11px] text-muted-foreground">+{file.tags.length - 3}</span>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onPeek(file)} className="gap-1 text-xs">
                  <Eye className="h-3.5 w-3.5" /> Peek
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpen(file)} className="gap-1 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
