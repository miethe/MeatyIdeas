"use client"
import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FileItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'
import { span } from '@/lib/telemetry'
import { MarkdownViewer } from '@/components/markdown-viewer'

type Props = { file: FileItem | null; onClose: () => void; projectId?: string; onDeleted?: () => void }

export function ItemModalViewer({ file, onClose, projectId, onDeleted }: Props) {
  const qc = useQueryClient()
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
  const tocRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!file) return
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
              <h1 className="mb-2 text-2xl font-bold">{file.title}</h1>
              <div className="mb-4 text-sm text-muted-foreground">{file.path}</div>
              <MarkdownViewer html={file.rendered_html} md={file.content_md} />
              <div className="mt-6 flex items-center justify-end gap-2">
                {file && (
                  <Button variant="destructive" onClick={() => del.mutate(file.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </article>
            <aside className="hidden max-h-[70vh] overflow-y-auto border-l pl-4 md:block">
              <div className="mb-2 text-sm font-semibold">Contents</div>
              <div ref={tocRef} className="space-y-1" />
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
