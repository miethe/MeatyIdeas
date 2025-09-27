"use client"

import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { span } from '@/lib/telemetry'
import { toast } from 'sonner'

import { FolderPathCombobox } from './folder-path-combobox'
import { FolderCreateDialog } from './folder-create-dialog'

type CreatePayload = {
  title?: string
  path: string
  tags: string[]
  frontMatter?: Record<string, unknown>
  content: string
}

export function FileCreateDialog({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [folder, setFolder] = React.useState('')
  const [filename, setFilename] = React.useState('')
  const [filenameEdited, setFilenameEdited] = React.useState(false)
  const [tags, setTags] = React.useState('')
  const [content, setContent] = React.useState('')
  const [pendingFolder, setPendingFolder] = React.useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)
  const qc = useQueryClient()

  const resetForm = React.useCallback(() => {
    setTitle('')
    setFolder('')
    setFilename('untitled.md')
    setFilenameEdited(false)
    setTags('')
    setContent('')
    setPendingFolder(null)
  }, [])

  const create = useMutation({
    mutationFn: async ({ title: titleValue, path, tags: tagList, frontMatter, content: body }: CreatePayload) =>
      apiJson('POST', `/files/project/${projectId}`, {
        title: titleValue,
        path,
        content_md: body,
        tags: tagList.length > 0 ? tagList : undefined,
        front_matter: frontMatter,
      }),
    onSuccess: () => {
      span('ui.create.file')
      toast.success('File created')
      qc.invalidateQueries({ queryKey: ['files', projectId] })
      setOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const message = error?.detail?.message || 'Failed to create file'
      toast.error(message)
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false)
      if (!create.isPending) resetForm()
      return
    }
    setOpen(true)
    resetForm()
  }

  const buildPath = React.useCallback(() => {
    const trimmedFolder = folder.trim().replace(/^\/+|\/+$/g, '')
    const trimmedName = ensureFilename(filename)
    if (!trimmedName) return ''
    return trimmedFolder ? `${trimmedFolder}/${trimmedName}` : trimmedName
  }, [folder, filename])

  React.useEffect(() => {
    if (!open) return
    if (!filenameEdited) {
      const slug = slugify(title)
      setFilename(slug ? `${slug}.md` : '')
    }
  }, [open, title, filenameEdited])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (filename.includes('/')) {
      toast.error('Filename cannot contain "/" — choose a folder using the selector.')
      return
    }
    const computedPath = buildPath()
    if (!computedPath) {
      toast.error('Filename required')
      return
    }
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const frontMatter = tagList.length > 0 ? { tags: tagList } : undefined
    create.mutate({
      title: title || undefined,
      path: computedPath,
      tags: tagList,
      frontMatter,
      content,
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>New Markdown File</DialogTitle>
            <DialogDescription>Pick a destination, add optional tags, and start writing.</DialogDescription>
          </DialogHeader>
          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm">Title</label>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  if (!filenameEdited) {
                    const slug = slugify(event.target.value)
                    setFilename(slug ? `${slug}.md` : '')
                  }
                }}
                placeholder="Feature PRD"
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1">
                <label className="text-sm">Folder</label>
                <FolderPathCombobox
                  projectId={projectId}
                  value={folder}
                  onChange={setFolder}
                  placeholder="Root /"
                  onRequestCreate={(path) => {
                    setPendingFolder(path)
                    setFolderDialogOpen(true)
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Filename</label>
                <input
                  value={filename}
                  onChange={(event) => {
                    setFilename(event.target.value)
                    setFilenameEdited(true)
                  }}
                  placeholder="feature-prd.md"
                  className="focus-ring block w-full rounded-md border bg-background px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Tags (comma separated)</label>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="PRD, Idea"
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Content</label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="# Title\n\nWrite some markdown..."
                className="focus-ring block h-44 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Path preview: <span className="font-mono text-foreground">/{buildPath()}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <FolderCreateDialog
        projectId={projectId}
        open={folderDialogOpen}
        onOpenChange={(next) => {
          setFolderDialogOpen(next)
          if (!next) setPendingFolder(null)
        }}
        initialPath={pendingFolder || folder}
        onCreated={(path) => {
          setFolder(path)
          qc.invalidateQueries({ queryKey: ['project-dirs', projectId] })
        }}
      />
    </>
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ensureFilename(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.includes('.')) return trimmed
  return `${trimmed}.md`
}
