"use client"

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiJson } from '@/lib/apiClient'
import { FolderPathCombobox } from '@/components/files/folder-path-combobox'
import { FolderCreateDialog } from '@/components/files/folder-create-dialog'
import { span } from '@/lib/telemetry'
import { TagMultiInput } from '@/components/files/tag-multi-input'
import { MarkdownEditor } from '@/components/files/markdown-editor'
import { ProjectInlineCreateDialog } from '@/components/projects/project-inline-create-dialog'
import { getConfig } from '@/lib/config'

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

type SavePayload = {
  projectId: string
  path: string
  title?: string
  tags: string[]
  frontMatter?: Record<string, unknown>
  content: string
  closeAfterSave: boolean
}

type ProjectOption = { id: string; name: string; slug?: string }

const TEMPLATE_OPTIONS = [{ value: 'blank', label: 'Blank' }]

export default function CreateFilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectFromQuery = searchParams.get('project')
  const qc = useQueryClient()

  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(initialProjectFromQuery)
  const [title, setTitle] = React.useState('')
  const [folder, setFolder] = React.useState('')
  const [filename, setFilename] = React.useState('')
  const [filenameEdited, setFilenameEdited] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [description, setDescription] = React.useState('')
  const [content, setContent] = React.useState('')
  const [typeKey, setTypeKey] = React.useState('')
  const [templateId, setTemplateId] = React.useState('blank')
  const [pendingFolder, setPendingFolder] = React.useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)
  const [previewHtml, setPreviewHtml] = React.useState('')
  const [previewPending, setPreviewPending] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const [lastSavedFileId, setLastSavedFileId] = React.useState<string | null>(null)
  const [lastSavedProjectId, setLastSavedProjectId] = React.useState<string | null>(null)
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
  })

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: 60_000 })
  const tagQuery = useQuery({
    queryKey: ['tags', 'all'],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/tags?limit=200`)
      return rows?.map((row) => (typeof row?.label === 'string' ? row.label : null)).filter(Boolean) as string[]
    },
    staleTime: 60_000,
  })

  const projectOptions = React.useMemo(() => {
    if (Array.isArray(projectsQuery.data)) {
      return projectsQuery.data as ProjectOption[]
    }
    return []
  }, [projectsQuery.data])

  const selectedProject = React.useMemo(() => projectOptions.find((proj) => proj.id === selectedProjectId), [projectOptions, selectedProjectId])

  React.useEffect(() => {
    if (!filenameEdited) {
      const slug = slugify(title)
      setFilename(slug ? `${slug}.md` : '')
    }
  }, [title, filenameEdited])

  React.useEffect(() => {
    let cancelled = false
    setPreviewPending(true)
    const timer = window.setTimeout(() => {
      apiJson<{ html: string }>('POST', '/render/markdown', { md: content })
        .then((res) => {
          if (!cancelled) setPreviewHtml(res?.html ?? '')
        })
        .catch(() => {
          if (!cancelled) setPreviewHtml('')
        })
        .finally(() => {
          if (!cancelled) setPreviewPending(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [content])

  const buildPath = React.useCallback(() => {
    const trimmedFolder = folder.trim().replace(/^\/+|\/+$/g, '')
    const trimmedName = ensureFilename(filename)
    if (!trimmedName) return ''
    return trimmedFolder ? `${trimmedFolder}/${trimmedName}` : trimmedName
  }, [folder, filename])

  const resetAfterSave = React.useCallback((fileId: string, projectId: string) => {
    setLastSavedFileId(fileId)
    setLastSavedProjectId(projectId)
    setDirty(false)
  }, [])

  const createMutation = useMutation({
    mutationFn: async (payload: SavePayload) => {
      const response = await apiJson('POST', '/files', {
        project_id: payload.projectId,
        title: payload.title,
        path: payload.path,
        content_md: payload.content,
        tags: payload.tags.length ? payload.tags : undefined,
        front_matter: payload.frontMatter,
      })
      return { response, closeAfterSave: payload.closeAfterSave }
    },
    onSuccess: ({ response, closeAfterSave }, variables) => {
      const fileId = response?.id as string | undefined
      span('ui.create.file', { project_id: variables.projectId, mode: 'full' })
      toast.success('File created')
      if (!fileId) return
      resetAfterSave(fileId, variables.projectId)
      qc.invalidateQueries({ queryKey: ['files', variables.projectId] })
      qc.invalidateQueries({ queryKey: ['recent-files'] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      if (closeAfterSave) {
        navigateToProject(fileId, variables.projectId)
      }
    },
    onError: (error: any) => {
      const message = error?.detail?.message || 'Failed to create file'
      toast.error(message)
      setDirty(true)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: SavePayload & { fileId: string }) => {
      const response = await apiJson('PUT', `/files/${payload.fileId}`, {
        title: payload.title,
        path: payload.path,
        content_md: payload.content,
        tags: payload.tags.length ? payload.tags : undefined,
        front_matter: payload.frontMatter,
        rewrite_links: true,
      })
      return { response, closeAfterSave: payload.closeAfterSave }
    },
    onSuccess: ({ response, closeAfterSave }, variables) => {
      const resolvedProjectId = response?.project_id || variables.projectId
      const resolvedFileId = response?.id || variables.fileId
      span('ui.update.file', { file_id: resolvedFileId, project_id: resolvedProjectId })
      toast.success('File saved')
      resetAfterSave(resolvedFileId, resolvedProjectId)
      qc.invalidateQueries({ queryKey: ['files', variables.projectId] })
      qc.invalidateQueries({ queryKey: ['recent-files'] })
      if (closeAfterSave) {
        const targetProject = resolvedProjectId || lastSavedProjectId
        const targetFile = resolvedFileId || lastSavedFileId
        if (targetProject && targetFile) navigateToProject(targetFile, targetProject)
        else router.back()
      }
    },
    onError: (error: any) => {
      const message = error?.detail?.message || 'Failed to save file'
      toast.error(message)
      setDirty(true)
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleTypeSelect = async (value: string) => {
    if (value === '__create__') {
      const label = window.prompt('New type name')?.trim()
      if (!label) return
      try {
        const created = await apiJson<any>('POST', '/file-types', { label })
        qc.invalidateQueries({ queryKey: ['config'] })
        setTypeKey(created.key)
        setDirty(true)
        toast.success('Type created')
      } catch (error: any) {
        toast.error(error?.detail || 'Unable to create type')
      }
      return
    }
    setTypeKey(value)
    setDirty(true)
  }

  const handleSave = (closeAfterSave: boolean) => {
    if (!selectedProjectId) {
      toast.error('Select a project before saving')
      return
    }
    const computedPath = buildPath()
    if (!computedPath) {
      toast.error('Filename required')
      return
    }
    const frontMatter: Record<string, unknown> = {}
    if (selectedTags.length) frontMatter.tags = selectedTags
    if (description.trim()) frontMatter.description = description.trim()
    if (typeKey) frontMatter.type = typeKey
    const payload: SavePayload = {
      projectId: selectedProjectId,
      title: title || undefined,
      path: computedPath,
      tags: selectedTags,
      frontMatter: Object.keys(frontMatter).length ? frontMatter : undefined,
      content,
      closeAfterSave,
    }
    setDirty(false)
    if (lastSavedFileId) {
      updateMutation.mutate({ ...payload, fileId: lastSavedFileId })
    } else {
      createMutation.mutate(payload)
    }
  }

  const navigateToProject = React.useCallback(
    (fileId: string, projectId: string) => {
      const project = projectOptions.find((item) => item.id === projectId)
      if (project?.slug) {
        router.push(`/projects/${project.slug}?file=${fileId}`)
      } else {
        router.push('/projects/' + projectId)
      }
    },
    [projectOptions, router],
  )

  React.useEffect(() => {
    if (initialProjectFromQuery && !selectedProjectId) {
      setSelectedProjectId(initialProjectFromQuery)
    }
  }, [initialProjectFromQuery, selectedProjectId])

  const actionDisabled = !selectedProjectId || isSaving
  const typeOptions = config?.FILE_TYPE_OPTIONS ?? []
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
  const tagSuggestions = tagQuery.data ?? []

  return (
    <AppShell currentProjectId={selectedProjectId}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create File</h1>
            <p className="text-sm text-muted-foreground">Use the full editor to author structured documentation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.back()} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={actionDisabled}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={actionDisabled || !(dirty || !lastSavedFileId)}>
              {isSaving ? 'Saving…' : 'Save & Close'}
            </Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="space-y-4">
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
                  setDirty(true)
                }}
                className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="">Select a project…</option>
                {projectOptions.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
                <option value="__create__">Create new project…</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Template</label>
                <select
                  value={templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value)
                    setDirty(true)
                  }}
                  className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
                >
                  {TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  placeholder="Feature PRD"
                  onChange={(event) => {
                    setTitle(event.target.value)
                    setDirty(true)
                    if (!filenameEdited) {
                      const slug = slugify(event.target.value)
                      setFilename(slug ? `${slug}.md` : '')
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Folder</label>
                <FolderPathCombobox
                  projectId={selectedProjectId ?? undefined}
                  value={folder}
                  onChange={(next) => {
                    setFolder(next)
                    setDirty(true)
                  }}
                  placeholder={selectedProject ? 'Root /' : 'Select project first'}
                  onRequestCreate={(path) => {
                    if (!selectedProjectId) {
                      toast.error('Select a project before creating folders')
                      return
                    }
                    setPendingFolder(path)
                    setFolderDialogOpen(true)
                  }}
                  disabled={!selectedProjectId || isSaving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Filename</label>
                <Input
                  value={filename}
                  placeholder="feature-prd.md"
                  onChange={(event) => {
                    setFilename(event.target.value)
                    setFilenameEdited(true)
                    setDirty(true)
                  }}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={typeKey}
                  onChange={(event) => void handleTypeSelect(event.target.value)}
                  className="focus-ring block w-full rounded-md border bg-background px-3 py-2"
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
                <TagMultiInput
                  value={selectedTags}
                  onChange={(next) => {
                    setSelectedTags(next)
                    setDirty(true)
                  }}
                  suggestions={tagSuggestions}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                placeholder="Short summary for metadata"
                onChange={(event) => {
                  setDescription(event.target.value)
                  setDirty(true)
                }}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Content</label>
              <MarkdownEditor
                value={content}
                onChange={(value) => {
                  setContent(value)
                  setDirty(true)
                }}
                projectId={selectedProjectId}
                disabled={isSaving}
                minRows={16}
              />
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Path preview: <span className="font-mono text-foreground">/{buildPath()}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-md border">
              <div className="border-b px-4 py-2 text-sm font-medium">Preview</div>
              <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
                {previewPending ? (
                  <p className="text-sm text-muted-foreground">Rendering preview…</p>
                ) : content.trim() ? (
                  <article className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <p className="text-sm text-muted-foreground">Start typing to see a live preview.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
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
            setDirty(true)
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
    </AppShell>
  )
}
