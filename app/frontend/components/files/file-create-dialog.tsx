"use client"

import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { span } from '@/lib/telemetry'
import { toast } from 'sonner'

import { FolderPathCombobox } from './folder-path-combobox'
import { FolderCreateDialog } from './folder-create-dialog'

type CreatePayload = {
  projectId: string
  title?: string
  path: string
  tags: string[]
  frontMatter?: Record<string, unknown>
  content: string
}

type FileCreateDialogProps = {
  projectId?: string | null
  initialProjectId?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function FileCreateDialog({
  projectId,
  initialProjectId,
  open: controlledOpen,
  onOpenChange,
  children,
}: FileCreateDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const qc = useQueryClient()

  const contextProjectId = projectId ?? initialProjectId ?? null
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(contextProjectId)
  const [title, setTitle] = React.useState('')
  const [folder, setFolder] = React.useState('')
  const [filename, setFilename] = React.useState('')
  const [filenameEdited, setFilenameEdited] = React.useState(false)
  const [tags, setTags] = React.useState('')
  const [content, setContent] = React.useState('')
  const [pendingFolder, setPendingFolder] = React.useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)

  const projectsQuery = useQuery({
    queryKey: ['projects-nav'],
    queryFn: async () => {
      const payload = await apiGet<any>(`/projects?limit=200&view=all`)
      if (Array.isArray(payload)) return payload
      if (payload && Array.isArray(payload.projects)) return payload.projects
      return []
    },
    staleTime: 10_000,
    enabled: open,
  })

  const projects = React.useMemo(() => {
    if (Array.isArray(projectsQuery.data)) return projectsQuery.data as Array<{ id: string; name: string }>
    return [] as Array<{ id: string; name: string }>
  }, [projectsQuery.data])

  const resetForm = React.useCallback(
    (preserveSelection = false) => {
      setTitle('')
      setFolder('')
      setFilename('untitled.md')
      setFilenameEdited(false)
      setTags('')
      setContent('')
      setPendingFolder(null)
      if (!preserveSelection) {
        setSelectedProjectId(contextProjectId)
      }
    },
    [contextProjectId]
  )

  const mutateCreate = useMutation({
    mutationFn: async ({ projectId: targetProjectId, title: titleValue, path, tags: tagList, frontMatter, content: body }: CreatePayload) =>
      apiJson('POST', '/files', {
        project_id: targetProjectId,
        title: titleValue,
        path,
        content_md: body,
        tags: tagList.length > 0 ? tagList : undefined,
        front_matter: frontMatter,
      }),
    onSuccess: (_, variables) => {
      span('ui.create.file', { project_id: variables.projectId, mode: 'quick' })
      toast.success('File created')
      qc.invalidateQueries({ queryKey: ['files', variables.projectId] })
      qc.invalidateQueries({ queryKey: ['project-dirs', variables.projectId] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      qc.invalidateQueries({ queryKey: ['recent-files'] })
      handleDialogOpenChange(false)
    },
    onError: (error: any) => {
      const message = error?.detail?.message || 'Failed to create file'
      toast.error(message)
    },
  })

  const handleDialogOpenChange = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(next)
      }
      if (next) {
        resetForm()
      } else if (!mutateCreate.isPending) {
        resetForm(true)
      }
      if (!next) {
        setFolderDialogOpen(false)
      }
      onOpenChange?.(next)
    },
    [controlledOpen, mutateCreate.isPending, onOpenChange, resetForm]
  )

  React.useEffect(() => {
    if (open) {
      setSelectedProjectId((prev) => prev ?? contextProjectId)
      if (!contextProjectId) {
        setSelectedProjectId(null)
      }
    }
  }, [contextProjectId, open])

  React.useEffect(() => {
    if (!open) return
    if (!filenameEdited) {
      const slug = slugify(title)
      setFilename(slug ? `${slug}.md` : '')
    }
  }, [open, title, filenameEdited])

  React.useEffect(() => {
    if (!selectedProjectId) {
      setFolder('')
    }
  }, [selectedProjectId])

  React.useEffect(() => {
    if (!selectedProjectId && folderDialogOpen) {
      setFolderDialogOpen(false)
    }
  }, [folderDialogOpen, selectedProjectId])

  const buildPath = React.useCallback(() => {
    const trimmedFolder = folder.trim().replace(/^\/+|\/+$/g, '')
    const trimmedName = ensureFilename(filename)
    if (!trimmedName) return ''
    return trimmedFolder ? `${trimmedFolder}/${trimmedName}` : trimmedName
  }, [folder, filename])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (filename.includes('/')) {
      toast.error('Filename cannot contain "/" — choose a folder using the selector.')
      return
    }
    if (!selectedProjectId) {
      toast.error('Select a project')
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
    mutateCreate.mutate({
      projectId: selectedProjectId,
      title: title || undefined,
      path: computedPath,
      tags: tagList,
      frontMatter,
      content,
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>New Markdown File</DialogTitle>
            <DialogDescription>Pick a destination, add optional tags, and start writing.</DialogDescription>
          </DialogHeader>
          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm">Project</label>
              <select
                value={selectedProjectId ?? ''}
                onChange={(event) => setSelectedProjectId(event.target.value || null)}
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
                disabled={projectsQuery.isLoading || mutateCreate.isPending}
                required
              >
                <option value="">Select a project…</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
              {!selectedProjectId && <p className="text-xs text-muted-foreground">Choose a project to enable folder selection and creation.</p>}
            </div>
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
                  projectId={selectedProjectId ?? undefined}
                  value={folder}
                  onChange={setFolder}
                  placeholder={selectedProjectId ? 'Root /' : 'Select project first'}
                  onRequestCreate={(path) => {
                    if (!selectedProjectId) {
                      toast.error('Select a project before creating folders')
                      return
                    }
                    setPendingFolder(path)
                    setFolderDialogOpen(true)
                  }}
                  disabled={!selectedProjectId || mutateCreate.isPending}
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
                placeholder="# Title

Write some markdown..."
                className="focus-ring block h-44 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Path preview: <span className="font-mono text-foreground">/{buildPath()}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={mutateCreate.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutateCreate.isPending}>
                {mutateCreate.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {selectedProjectId && (
        <FolderCreateDialog
          projectId={selectedProjectId}
          open={folderDialogOpen}
          onOpenChange={(next) => {
            setFolderDialogOpen(next)
            if (!next) setPendingFolder(null)
          }}
          initialPath={pendingFolder || folder}
          onCreated={(path) => {
            setFolder(path)
            qc.invalidateQueries({ queryKey: ['project-dirs', selectedProjectId] })
          }}
        />
      )}
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
