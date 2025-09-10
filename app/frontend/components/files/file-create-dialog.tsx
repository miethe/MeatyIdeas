"use client"
import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { span } from '@/lib/telemetry'
import { toast } from 'sonner'

export function FileCreateDialog({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [path, setPath] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [content, setContent] = React.useState('')
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async () =>
      apiJson('POST', `/files/project/${projectId}`, {
        title: title || undefined,
        path: path || (title ? `${title.toLowerCase().replace(/\s+/g, '-')}.md` : 'untitled.md'),
        content_md: content,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        front_matter: {},
      }),
    onSuccess: () => {
      span('ui.create.file')
      toast.success('File created')
      qc.invalidateQueries({ queryKey: ['files', projectId] })
      setOpen(false)
      setTitle('')
      setPath('')
      setTags('')
      setContent('')
    },
    onError: () => toast.error('Failed to create file'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Markdown File</DialogTitle>
          <DialogDescription>Provide a title or path, optional tags, and content.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Feature PRD" className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Path</label>
              <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="specs/feature-prd.md" className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm">Tags (comma separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="PRD, Idea" className="focus-ring block w-full rounded-md border bg-background px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="# Title\n\nWrite some markdown..." className="focus-ring block h-44 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
