"use client"

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, ExternalLink, Eye } from 'lucide-react'

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
    return date.toLocaleString()
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
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Recent Files</h3>
          <p className="text-xs text-muted-foreground">Latest updates across your workspace.</p>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-16" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">Unable to load recent files right now.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity yet. Files you create or edit will appear here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((file) => (
            <li key={file.id} className="rounded-md border px-3 py-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{file.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{file.project.name}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatRelativeTime(file.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onPeek(file)} className="gap-1">
                    <Eye className="h-3.5 w-3.5" /> Peek
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onOpen(file)} className="gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
