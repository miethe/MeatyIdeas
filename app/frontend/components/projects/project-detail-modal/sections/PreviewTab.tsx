import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/skeleton'
import { ExternalLink, FileWarning } from 'lucide-react'

import { MarkdownViewer } from '@/components/markdown-viewer'
import { ImagePreview } from '@/components/files/image-preview'
import { FilePreview, ProjectModalSummary } from '@/lib/types'

import { TreeSelection } from '../types'

type PreviewTabProps = {
  summary: ProjectModalSummary | undefined
  selection: TreeSelection | null
  preview: FilePreview | undefined
  loading: boolean
  error: unknown
  highlightedHtml: string | null
  isHighlighting: boolean
}

export function PreviewTab({
  summary,
  selection,
  preview,
  loading,
  error,
  highlightedHtml,
  isHighlighting,
}: PreviewTabProps) {
  if (!selection) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a file to preview.</div>
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-[320px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        Failed to load preview.
      </div>
    )
  }

  if (!preview) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No preview available.</div>
  }

  if (preview.preview_type === 'image') {
    const updated = preview.updated_at ? new Date(preview.updated_at) : null
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-6 py-3">
          <div className="text-sm font-medium">{preview.title}</div>
          <div className="text-xs text-muted-foreground">
            {preview.path} • {preview.size.toLocaleString()} bytes
            {updated && <> • Updated {updated.toLocaleString()}</>}
          </div>
        </div>
        <ImagePreview src={preview.preview_url || `/files/${preview.id}/raw`} alt={preview.title} />
      </div>
    )
  }

  if (preview.preview_type !== 'text') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <FileWarning className="h-10 w-10" />
        <div>
          <div className="font-medium">Preview unsupported</div>
          <p className="text-xs">This file type cannot be previewed in the modal. Open the project to view it fully.</p>
        </div>
        {summary && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/projects/${summary.slug}?file=${preview.id}`, '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Open in project
          </Button>
        )}
      </div>
    )
  }

  const updated = preview.updated_at ? new Date(preview.updated_at) : null
  const isMarkdown = (preview.language || '').toLowerCase() === 'markdown'
  const header = (
    <div className="border-b px-6 py-3">
      <div className="text-sm font-medium">{preview.title}</div>
      <div className="text-xs text-muted-foreground">
        {preview.path} • {preview.size.toLocaleString()} bytes
        {updated && <> • Updated {updated.toLocaleString()}</>}
        {preview.is_truncated && (
          <> • Truncated preview (first {(Math.round((preview.content?.length || 0) / 1000) || 0).toLocaleString()} KB)</>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isMarkdown && preview.rendered_html ? (
          <MarkdownViewer
            html={preview.rendered_html}
            md={preview.content || ''}
            projectId={preview.project_id}
            filePath={preview.path}
          />
        ) : highlightedHtml ? (
          <pre className="language" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{isHighlighting ? 'Highlighting…' : preview.content}</pre>
        )}
      </div>
    </div>
  )
}
