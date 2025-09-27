"use client"
import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FileItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'
import { span } from '@/lib/telemetry'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { ImagePreview } from '@/components/files/image-preview'
import { FileMetadataList } from '@/components/files/file-metadata-list'
import { TagChip, OverflowTagChip } from '@/components/tags/tag-chip'

type Props = { file: FileItem | null; onClose: () => void; projectId?: string; onDeleted?: () => void }

export function ItemModalViewer({ file, onClose, projectId, onDeleted }: Props) {
  const qc = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const isImageFile = file ? isImagePath(file.path) : false
  useEffect(() => {
    if (!file) return
    setIsEditing(false)
    setTitle(file.title || '')
    setPath(file.path || '')
    setTags((file.tags || []).join(', '))
    setContent(file.content_md || '')
  }, [file?.id])
  const del = useMutation({
    mutationFn: async (id: string) => apiJson('DELETE', `/files/${id}`, null as any),
    onSuccess: () => {
      span('ui.delete.file')
      toast.success('File deleted')
      if (projectId) qc.invalidateQueries({ queryKey: ['files', projectId] })
      onDeleted?.()
      onClose()
    },
    onError: () => toast.error('Failed to delete file'),
  })
  const update = useMutation({
    mutationFn: async () =>
      apiJson('PUT', `/files/${file!.id}`, {
        title: title || undefined,
        path: path,
        content_md: content,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        front_matter: file?.front_matter || undefined,
      }),
    onSuccess: () => {
      toast.success('File updated')
      if (projectId) qc.invalidateQueries({ queryKey: ['files', projectId] })
      setIsEditing(false)
    },
    onError: () => toast.error('Failed to update file'),
  })
  const tocRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!file || isImagePath(file.path)) return
    // generate IDs for headings and a simple ToC
    const container = document.querySelector('#md-view')
    if (!container) return
    const headings = Array.from(container.querySelectorAll('h1, h2, h3')) as HTMLElement[]
    const items = headings.map((h) => {
      const text = h.textContent || ''
      const id = h.id || text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')
      h.id = id
      return { id, text, level: h.tagName.toLowerCase() }
    })
    if (tocRef.current) {
      tocRef.current.innerHTML = items
        .map((it) => `<a href="#${it.id}" class="block text-sm ${it.level === 'h2' ? 'ml-2' : it.level === 'h3' ? 'ml-4' : ''}">${it.text}</a>`)
        .join('')
    }
  }, [file?.id, file?.rendered_html])

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] w-full max-w-5xl overflow-hidden">
        {file && (
          <div className="grid grid-cols-[1fr_240px] gap-6">
            <article id="md-view" className="prose prose-invert max-w-none dark:prose-invert overflow-y-auto pr-2">
              {!isEditing ? (
                <>
                  <h1 className="mb-2 text-2xl font-bold">{file.title}</h1>
                  <div className="mb-4 text-sm text-muted-foreground">{file.path}</div>
                  {file.tag_details && file.tag_details.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1">
                      {file.tag_details.slice(0, 6).map((tag) => (
                        <TagChip key={tag.slug} tag={tag} maxWidth={140} />
                      ))}
                      {file.tag_details.length > 6 && <OverflowTagChip overflow={file.tag_details.slice(6)} />}
                    </div>
                  )}
                  {file.metadata_fields && file.metadata_fields.length > 0 && (
                    <div className="mb-6">
                      <FileMetadataList fields={file.metadata_fields} />
                    </div>
                  )}
                  {isImageFile ? (
                    <ImagePreview
                      src={`/projects/${file.project_id}/files/raw?path=${encodeURIComponent(file.path)}`}
                      alt={file.title}
                      className="bg-transparent p-0"
                      imageClassName="max-h-[70vh] max-w-full"
                    />
                  ) : (
                    <MarkdownViewer
                      html={file.rendered_html}
                      md={file.content_md}
                      projectId={file.project_id}
                      filePath={file.path}
                    />
                  )}
                  <div className="mt-6 flex items-center justify-end gap-2">
                    {!isImageFile && file && (
                      <a className="underline-offset-2 hover:underline" href={`/projects/${file.project_id}/edit/${file.id}`}>
                        Open in Editor
                      </a>
                    )}
                    {!isImageFile && (
                      <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
                    )}
                    {file && (
                      <Button variant="destructive" onClick={() => del.mutate(file.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <form
                  className="mt-1 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    update.mutate()
                  }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm">Title</label>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm">Path</label>
                      <input value={path} onChange={(e) => setPath(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm">Tags (comma separated)</label>
                    <input value={tags} onChange={(e) => setTags(e.target.value)} className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm">Content</label>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} className="focus-ring block h-44 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button type="submit" disabled={update.isPending}>Save</Button>
                  </div>
                </form>
              )}
            </article>
            <aside className="hidden max-h-[70vh] overflow-y-auto border-l pl-4 md:block">
              {!isImageFile && (
                <>
                  <div className="mb-2 text-sm font-semibold">Contents</div>
                  <div ref={tocRef} className="space-y-1" />
                </>
              )}
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function isImagePath(path: string | undefined | null): boolean {
  if (!path) return false
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return false
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'heif', 'avif'].includes(ext)
}
