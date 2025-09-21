import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/skeleton'
import { ExternalLink, Star, StarOff } from 'lucide-react'

import { ProjectModalSummary } from '@/lib/types'

type ModalHeaderProps = {
  summary: ProjectModalSummary | undefined
  loading: boolean
  onExpand: () => void
  onToggleStar: () => void
  starPending: boolean
  error?: Error | null
}

export function ModalHeader({ summary, loading, onExpand, onToggleStar, starPending, error }: ModalHeaderProps) {
  if (loading && !summary) {
    return (
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="text-lg font-semibold">Project</div>
          <div className="text-sm text-muted-foreground">
            {error ? `Error loading metadata: ${error.message}` : 'Unable to load project metadata.'}
          </div>
        </div>
        <Button variant="outline" onClick={onExpand}>
          <ExternalLink className="mr-2 h-4 w-4" /> Expand
        </Button>
      </div>
    )
  }

  const updated = summary.updated_at ? new Date(summary.updated_at) : null

  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{summary.name}</h2>
          <Badge variant="outline" className="text-xs uppercase">
            {summary.status}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {summary.description || 'No description provided.'}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {updated && <span>Updated {updated.toLocaleString()}</span>}
          <span>· {summary.file_count} files</span>
          <span>· {summary.directory_count} folders</span>
        </div>
        {summary.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.tags.map((tag) => (
              <Badge
                key={tag.slug}
                variant="secondary"
                style={tag.color ? { backgroundColor: `${tag.color}26`, color: tag.color } : undefined}
              >
                #{tag.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onToggleStar} disabled={starPending}>
          {summary.is_starred ? (
            <>
              <Star className="mr-2 h-4 w-4 fill-current" /> Unstar
            </>
          ) : (
            <>
              <StarOff className="mr-2 h-4 w-4" /> Star
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onExpand}>
          <ExternalLink className="mr-2 h-4 w-4" /> Expand →
        </Button>
      </div>
    </div>
  )
}
