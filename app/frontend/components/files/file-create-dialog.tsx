"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { span } from '@/lib/telemetry'
import { toast } from 'sonner'

import { FolderPathCombobox } from './folder-path-combobox'
import { FolderCreateDialog } from './folder-create-dialog'
import { TagMultiInput } from './tag-multi-input'
import { MarkdownEditor } from './markdown-editor'
import { ProjectInlineCreateDialog } from '@/components/projects/project-inline-create-dialog'
import { getConfig } from '@/lib/config'

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

type ProjectOption = {
  id: string
  name: string
  slug?: string
  color?: string | null
}

export function FileCreateDialog({
  projectId,
  initialProjectId,
  open: controlledOpen,
  onOpenChange,
  children,
}: FileCreateDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = controlledOpen ?? internalOpen
  const qc = useQueryClient()

  const contextProjectId = projectId ?? initialProjectId ?? null
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(contextProjectId)
  const [title, setTitle] = React.useState('')
  const [folder, setFolder] = React.useState('')
  const [filename, setFilename] = React.useState('untitled.md')
  const [filenameEdited, setFilenameEdited] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [typeKey, setTypeKey] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [content, setContent] = React.useState('')
  const [pendingFolder, setPendingFolder] = React.useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)

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

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: 60_000 })

  const tagQuery = useQuery({
    queryKey: ['tags', 'all'],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/tags?limit=200`)
      return rows?.map((row) => (typeof row?.label === 'string' ? row.label : null)).filter(Boolean) as string[]
    },
    enabled: open,
    staleTime: 60_000,
  })

  const projects = React.useMemo<ProjectOption[]>(() => {
    const raw = projectsQuery.data
    if (!raw) return []
    if (Array.isArray(raw)) return raw as ProjectOption[]
    return []
  }, [projectsQuery.data])

  const tagSuggestions = tagQuery.data ?? []

  const statusOptions = config?.PROJECT_STATUS_OPTIONS ?? [
    { key: 'idea', label: 'Idea' },
    { key: 'discovery', label: 'Discovery' },
    { key: 'draft', label: 'Draft' },
    { key: 'live', label: 'Live' },
    { key: 'archived', label: 'Archived' },
  ]
  const templateOptions = config?.PROJECT_TEMPLATES ?? [
    { key: 'blank', label: 'Blank', description: 'Start from scratch' },
  ]
  const typeOptions = config?.FILE_TYPE_OPTIONS ?? []

  const resetForm = React.useCallback(
    (preserveSelection = false) => {
      setTitle('')
      setFolder('')
      setFilename('untitled.md')
      setFilenameEdited(false)
      setSelectedTags([])
      setTypeKey('')
      setDescription('')
      setContent('')
      setPendingFolder(null)
      setExpanded(false)
      if (!preserveSelection) {
        setSelectedProjectId(contextProjectId)
      }
    },
    [contextProjectId]
  )

  const handleOpenCreatedFile = React.useCallback(
    (created: any, projectIdentifier: string) => {
      if (!created || !created.id) return
      const projectContext = created.project || projects.find((proj) => proj.id === projectIdentifier)
      const slug = projectContext?.slug || projects.find((proj) => proj.id === projectIdentifier)?.slug
      const target = slug || projectIdentifier
      router.push(`/projects/${target}?file=${created.id}`)
    },
    [projects, router]
  )

  const mutateCreate = useMutation({
    mutationFn: async ({ projectId: targetProjectId, title: titleValue, path, tags: tagList, frontMatter, content: body }: CreatePayload) =>
      apiJson<any>('POST', '/files', {
        project_id: targetProjectId,
        title: titleValue,
        path,
        content_md: body,
        tags: tagList.length > 0 ? tagList : undefined,
        front_matter: frontMatter,
      }),
    onSuccess: (created, variables) => {
      span('ui.create.file', { project_id: variables.projectId, mode: 'quick' })
      toast.success('File created')
      qc.invalidateQueries({ queryKey: ['files', variables.projectId] })
      qc.invalidateQueries({ queryKey: ['project-dirs', variables.projectId] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      qc.invalidateQueries({ queryKey: ['recent-files'] })
      handleDialogOpenChange(false)
      handleOpenCreatedFile(created, variables.projectId)
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
      setFilename(slug ? `${slug}.md` : 'untitled.md')
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
    const frontMatter: Record<string, unknown> = {}
    if (selectedTags.length > 0) frontMatter.tags = selectedTags
    if (typeKey) frontMatter.type = typeKey
    if (description.trim()) frontMatter.description = description.trim()
    mutateCreate.mutate({
      projectId: selectedProjectId,
      title: title || undefined,
      path: computedPath,
      tags: selectedTags,
      frontMatter: Object.keys(frontMatter).length ? frontMatter : undefined,
      content,
    })
  }

  const handleTypeSelect = async (value: string) => {
    if (value === '__create__') {
      const label = window.prompt('New type name')?.trim()
      if (!label) return
      try {
        const created = await apiJson<any>('POST', '/file-types', { label })
        qc.invalidateQueries({ queryKey: ['config'] })
        setTypeKey(created.key)
        toast.success('Type created')
      } catch (error: any) {
        toast.error(error?.detail || 'Unable to create type')
      }
      return
    }
    setTypeKey(value)
  }

  const dialogWidth = expanded ? 'sm:max-w-[840px]' : 'sm:max-w-[680px]'

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
        <DialogContent className={dialogWidth}>
          <DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle>New Markdown File</DialogTitle>
                <DialogDescription>Pick a destination, add metadata, and start writing.</DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExpanded((prev) => {
                    const next = !prev
                    span('file.create.expand', { mode: 'quick_dialog', expanded: next })
                    return next
                  })
                }}
              >
                {expanded ? 'Compact view' : 'Expand form'}
              </Button>
            </div>
          </DialogHeader>
          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium">Project</label>
              <select
                value={selectedProjectId ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '__create__') {
                    setCreateProjectOpen(true)
                    return
                  }
                  setSelectedProjectId(value || null)
                }}
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
                <option value="__create__">Create new project…</option>
              </select>
              {!selectedProjectId && <p className="text-xs text-muted-foreground">Choose a project to enable folder selection and backlinks.</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  if (!filenameEdited) {
                    const slug = slugify(event.target.value)
                    setFilename(slug ? `${slug}.md` : 'untitled.md')
                  }
                }}
                placeholder="Feature PRD"
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1">
                <label className="text-sm font-medium">Folder</label>
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
                <label className="text-sm font-medium">Filename</label>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={typeKey}
                  onChange={(event) => void handleTypeSelect(event.target.value)}
                  className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
                  disabled={mutateCreate.isPending}
                >
                  <option value="">Select type…</option>
                  {typeOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="__create__">Create new type…</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tags</label>
                <TagMultiInput value={selectedTags} onChange={setSelectedTags} suggestions={tagSuggestions} disabled={mutateCreate.isPending} />
              </div>
            </div>
            {expanded && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short summary for metadata"
                  className="focus-ring block w-full rounded-md border bg-background px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Content</label>
              <MarkdownEditor value={content} onChange={setContent} projectId={selectedProjectId} disabled={mutateCreate.isPending} minRows={expanded ? 16 : 10} />
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
      <ProjectInlineCreateDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        statusOptions={statusOptions}
        templateOptions={templateOptions}
        onCreated={(proj) => {
          setCreateProjectOpen(false)
          setSelectedProjectId(proj.id)
          projectsQuery.refetch().catch(() => {})
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
