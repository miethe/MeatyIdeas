import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/skeleton'
import { Activity, FileText, GitCommit, Loader2, RefreshCcw } from 'lucide-react'

import { ProjectActivityEntry } from '@/lib/types'

type ActivityTabProps = {
  entries: ProjectActivityEntry[]
  loading: boolean
  fetchNext: () => void
  hasNext: boolean | undefined
  fetchingNext: boolean
}

export function ActivityTab({ entries, loading, fetchNext, hasNext, fetchingNext }: ActivityTabProps) {
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} className="h-12" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No recent activity.</div>
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="space-y-4 px-6 py-4">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <ActivityIcon type={entry.type} />
              <div>
                <div className="text-sm font-medium">{entry.message}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()}
                  {entry.actor && <> • {entry.actor}</>}
                  {entry.type === 'commit' && entry.context?.short_sha && <span> • {entry.context.short_sha}</span>}
                  {entry.type === 'file_change' && entry.context?.path && <span> • {entry.context.path}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {hasNext && (
        <div className="border-t p-3 text-center">
          <Button variant="ghost" size="sm" onClick={fetchNext} disabled={fetchingNext}>
            {fetchingNext ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {fetchingNext ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'commit') return <GitCommit className="mt-1 h-4 w-4 text-primary" />
  if (type === 'file_change') return <FileText className="mt-1 h-4 w-4 text-primary/70" />
  return <Activity className="mt-1 h-4 w-4 text-muted-foreground" />
}
