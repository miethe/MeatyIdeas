"use client"

import React from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/app-shell'
import { apiGet, apiJson } from '@/lib/apiClient'
import {
  ProjectCard,
  ProjectCardLanguageStat,
  ProjectCardSchema,
  ProjectListResponse,
  ProjectListResponseSchema,
  ProjectGroupWithProjectsSchema,
  ProjectGroupWithProjects,
  ProjectSchema,
  Project,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/skeleton'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Star, ExternalLink, Eye, Filter } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getConfig } from '@/lib/config'
import { ProjectDetailModal } from '@/components/projects/project-detail-modal/index'
import { ProjectEditDialog } from '@/components/projects/project-edit-dialog'
import { ProjectGroupsDialog } from '@/components/projects/project-groups-dialog'
import { ProjectActionsMenu } from '@/components/projects/project-actions-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const BASE_VIEW_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'starred', label: 'Starred' },
  { id: 'recent', label: 'Recently Updated' },
  { id: 'archived', label: 'Archived' },
]

const UPDATED_PRESETS = [
  { id: 'any', label: 'Any time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
]

type Density = 'compact' | 'standard' | 'rich'

const DENSITY_OPTIONS: Array<{ id: Density; label: string }> = [
  { id: 'compact', label: 'Compact' },
  { id: 'standard', label: 'Standard' },
  { id: 'rich', label: 'Rich' },
]

function decodeList(param: string | null): string[] {
  if (!param) return []
  return param
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function encodeList(values: string[]): string | null {
  if (!values.length) return null
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).join(',')
}

function slugifyTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveUpdatedRange(preset: string): { updated_after?: string; updated_before?: string } {
  const now = new Date()
  if (preset === '7d') {
    const dt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { updated_after: dt.toISOString() }
  }
  if (preset === '30d') {
    const dt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { updated_after: dt.toISOString() }
  }
  if (preset === '90d') {
    const dt = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    return { updated_after: dt.toISOString() }
  }
  return {}
}

async function fetchProjects(params: {
  view: string
  tags: string[]
  languages: string[]
  owner: string
  updatedPreset: string
  cursor?: string
}): Promise<ProjectListResponse> {
  const search = new URLSearchParams()
  if (params.view && params.view !== 'all') {
    search.set('view', params.view)
  }
  if (params.tags.length) {
    params.tags.forEach((tag) => search.append('tags[]', tag))
  }
  if (params.languages.length) {
    params.languages.forEach((lang) => search.append('language[]', lang))
  }
  if (params.owner && params.owner !== 'all') {
    search.set('owner', params.owner)
  }
  const range = resolveUpdatedRange(params.updatedPreset)
  if (range.updated_after) search.set('updated_after', range.updated_after)
  if (range.updated_before) search.set('updated_before', range.updated_before)
  search.set('limit', '20')
  if (params.cursor) search.set('cursor', params.cursor)

  const payload = await apiGet(`/projects?${search.toString()}`)
  const parsed = ProjectListResponseSchema.safeParse(payload)
  if (parsed.success) {
    return parsed.data
  }

  console.error('projects response validation failed', parsed.error, payload)

  const projects = Array.isArray((payload as any)?.projects)
    ? ((payload as any).projects as unknown[])
    : []

  return {
    projects: projects as ProjectCard[],
    next_cursor: typeof (payload as any)?.next_cursor === 'string' ? (payload as any).next_cursor : null,
    total: typeof (payload as any)?.total === 'number' ? (payload as any).total : projects.length,
    limit: typeof (payload as any)?.limit === 'number' ? (payload as any).limit : 20,
    view: typeof (payload as any)?.view === 'string' ? (payload as any).view : params.view,
    filters:
      (payload as any)?.filters && typeof (payload as any)?.filters === 'object'
        ? ((payload as any).filters as Record<string, unknown>)
        : {},
  }
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const qc = useQueryClient()
  const [editingProject, setEditingProject] = React.useState<ProjectCard | null>(null)
  const [groupsProject, setGroupsProject] = React.useState<ProjectCard | null>(null)
  const [deleteProject, setDeleteProject] = React.useState<ProjectCard | null>(null)

  const viewParam = searchParams.get('view') ?? 'all'
  const tags = decodeList(searchParams.get('tags'))
  const languages = decodeList(searchParams.get('languages'))
  const owner = searchParams.get('owner') ?? 'all'
  const updatedPreset = searchParams.get('updated') ?? 'any'
  const densityParam = (searchParams.get('density') as Density | null) ?? null

  const effectiveView = viewParam === 'tag' && tags.length === 0 ? 'all' : viewParam
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: 60_000 })
  const groupsEnabled = (config?.GROUPS_UI || 0) === 1
  const projectModalEnabled = (config?.PROJECT_MODAL || 0) === 1
  const searchParamString = searchParams.toString()
  const modalParam = searchParams.get('modal')
  const modalIdParam = searchParams.get('id')
  const [modalProjectId, setModalProjectId] = React.useState<string | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const lastFocusRef = React.useRef<HTMLElement | null>(null)
  const openedFromDashboardRef = React.useRef(false)

  React.useEffect(() => {
    if (projectModalEnabled && modalParam === 'project' && modalIdParam) {
      setModalProjectId((prev) => (prev === modalIdParam ? prev : modalIdParam))
      setModalOpen(true)
    } else {
      setModalOpen(false)
      setModalProjectId(null)
    }
  }, [projectModalEnabled, modalParam, modalIdParam])
  const viewOptions = React.useMemo(() => {
    const base = [...BASE_VIEW_OPTIONS]
    if (groupsEnabled && !base.find((opt) => opt.id === 'groups')) {
      base.splice(3, 0, { id: 'groups', label: 'Groups' })
    }
    return base
  }, [groupsEnabled])
  React.useEffect(() => {
    if (viewParam === 'tag' && tags.length === 0) {
      updateParams({ view: null })
    }
  }, [viewParam, tags.length])

  React.useEffect(() => {
    if (!groupsEnabled && viewParam === 'groups') {
      updateParams({ view: null })
    }
  }, [groupsEnabled, viewParam])

  const isGroupsView = groupsEnabled && effectiveView === 'groups'

  const [density, setDensity] = React.useState<Density>('standard')

  React.useEffect(() => {
    if (!densityParam) {
      try {
        const stored = window.localStorage.getItem('dashboard.density') as Density | null
        if (stored && DENSITY_OPTIONS.some(opt => opt.id === stored)) {
          setDensity(stored)
        }
      } catch {}
    }
  }, [densityParam])

  React.useEffect(() => {
    if (densityParam && densityParam !== density) {
      setDensity(densityParam)
    }
  }, [densityParam])

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    })
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const backendView = effectiveView === 'tag' || isGroupsView ? 'all' : effectiveView

  const projectsQuery = useInfiniteQuery({
    queryKey: [
      'dashboard-projects',
      {
        view: backendView,
        tags,
        languages,
        owner,
        updated: updatedPreset,
      },
    ],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      fetchProjects({
        view: backendView,
        tags,
        languages,
        owner,
        updatedPreset,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: undefined,
  })

  const allProjects = React.useMemo(() => {
    if (!projectsQuery.data) return [] as ProjectCard[]
    const items: ProjectCard[] = []
    for (const page of projectsQuery.data.pages) {
      for (const raw of page.projects) {
        const parsed = ProjectCardSchema.safeParse(raw)
        if (parsed.success) {
          items.push(parsed.data)
        } else {
          console.error('project card validation failed', parsed.error, raw)
          items.push(raw as ProjectCard)
        }
      }
    }
    return items
  }, [projectsQuery.data])

  const languageOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const project of allProjects) {
      for (const stat of project.language_mix) {
        if (stat.language) set.add(stat.language)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allProjects])

  const tagsQuery = useQuery({
    queryKey: ['dashboard-tags'],
    queryFn: async () => {
      const res = await apiGet('/filters/tags?limit=200')
      if (!Array.isArray(res)) return [] as Array<{ slug: string; label: string; count: number; color?: string | null }>
      return (res as Array<any>).map((item) => ({
        slug: String(item.slug || item.name || ''),
        label: String(item.label || item.name || ''),
        count: Number(item.count ?? item.usage_count ?? 0),
        color: item.color ?? null,
      }))
    },
    staleTime: 60_000,
  })

  const tagLabelLookup = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const tag of tagsQuery.data || []) {
      if (tag.slug) map[tag.slug] = tag.label || tag.slug
    }
    return map
  }, [tagsQuery.data])

  const groupsQuery = useQuery({
    queryKey: ['project-groups'],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/project-groups`)
      return rows.map((r) => ProjectGroupWithProjectsSchema.parse(r)) as ProjectGroupWithProjects[]
    },
    enabled: isGroupsView,
  })

  const projectsForGroupsQuery = useQuery({
    queryKey: ['projects-groups'],
    queryFn: async () => {
      const payload = await apiGet<any>(`/projects?limit=500&view=all`)
      const items = Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload)
          ? payload
          : []
  return items.map((it: unknown) => ProjectSchema.parse(it)) as Project[]
    },
    enabled: isGroupsView,
  })

  const createGroupMutation = useMutation({
    mutationFn: async (body: { name: string; color?: string | null }) =>
      apiJson('POST', `/project-groups`, body as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-groups'] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
    },
  })

  const renameGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      apiJson('PATCH', `/project-groups/${id}`, { name } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => apiJson('DELETE', `/project-groups/${id}`, null as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })

  const assignGroupMutation = useMutation({
    mutationFn: async ({ group_id, project_id }: { group_id: string; project_id: string }) =>
      apiJson('POST', `/project-groups/${group_id}/assign`, { project_id } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })

  const unassignGroupMutation = useMutation({
    mutationFn: async (project_id: string) => apiJson('DELETE', `/project-groups/assign/${project_id}`, null as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })

  const starMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      if (next) await apiJson('POST', `/projects/${id}/star`, null)
      else await apiJson('DELETE', `/projects/${id}/star`, null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      toast.success('Updated project star')
    },
    onError: () => toast.error('Unable to update star, please retry'),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiJson('DELETE', `/projects/${projectId}`, null)
    },
    onSuccess: () => {
      toast.success('Project deleted')
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] })
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      setDeleteProject(null)
    },
    onError: () => {
      toast.error('Unable to delete project')
    },
  })

  const handleViewChange = (next: string) => {
    if (next === 'tag') {
      updateParams({ view: 'tag' })
      return
    }
    updateParams({ view: next === 'all' ? null : next })
  }

  const handleSelectTag = (tag: string) => {
    const next = tags.includes(tag) ? tags : [...tags, tag]
    updateParams({ tags: encodeList(next), view: 'tag' })
  }

  const handleRemoveTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag)
    updateParams({ tags: encodeList(next), view: next.length ? 'tag' : null })
  }

  const handleAddTag = () => {
    const input = window.prompt('Filter by tag:')
    if (!input) return
    const slug = slugifyTag(input)
    if (!slug) return
    if (tags.includes(slug)) return
    updateParams({ tags: encodeList([...tags, slug]), view: 'tag' })
  }

  const handleToggleLanguage = (lang: string) => {
    const next = languages.includes(lang) ? languages.filter((l) => l !== lang) : [...languages, lang]
    updateParams({ languages: encodeList(next) })
  }

  const handleUpdatedChange = (preset: string) => {
    updateParams({ updated: preset === 'any' ? null : preset })
  }

  const handleOwnerChange = (value: string) => {
    updateParams({ owner: value === 'all' ? null : value })
  }

  const handleDensityChange = (value: Density) => {
    setDensity(value)
    try {
      window.localStorage.setItem('dashboard.density', value)
    } catch {}
    updateParams({ density: value === 'standard' ? null : value })
  }

  const handleResetFilters = () => {
    updateParams({ tags: null, languages: null, updated: null, owner: null, view: null })
  }

  const handleToggleStar = (project: ProjectCard) => {
    starMutation.mutate({ id: project.id, next: !project.is_starred })
  }

  const closeModal = React.useCallback(() => {
    setModalOpen(false)
    setModalProjectId(null)
    if (openedFromDashboardRef.current) {
      openedFromDashboardRef.current = false
      router.back()
      return
    }
    const params = new URLSearchParams(searchParamString)
    params.delete('modal')
    params.delete('id')
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParamString])

  const handleModalOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) closeModal()
    },
    [closeModal]
  )

  const handleModalAfterClose = React.useCallback(() => {
    if (lastFocusRef.current) {
      try {
        lastFocusRef.current.focus()
      } catch {}
      lastFocusRef.current = null
    }
  }, [])

  const handleExpandFromModal = React.useCallback(
    ({ slug }: { id: string; slug: string }) => {
      openedFromDashboardRef.current = false
      router.push(`/projects/${slug}`)
    },
    [router]
  )

  const handleQuickPeek = (project: ProjectCard) => {
    if (!projectModalEnabled) {
      router.push(`/projects/${project.slug}`)
      return
    }
    openedFromDashboardRef.current = true
    lastFocusRef.current = document.activeElement as HTMLElement | null
    setModalProjectId(project.id)
    setModalOpen(true)
    const params = new URLSearchParams(searchParamString)
    params.set('modal', 'project')
    params.set('id', project.id)
    const next = params.toString()
    router.push(next ? `${pathname}?${next}` : `${pathname}?modal=project&id=${project.id}`, { scroll: false })
  }

  const handleQuickOpen = (project: ProjectCard) => {
    window.open(`/projects/${project.slug}`, '_blank')
  }

  const sidebar = (
    <DashboardSidebar
      activeView={effectiveView}
      tags={tags}
      availableTags={tagsQuery.data || []}
      onChangeView={handleViewChange}
      onSelectTag={handleSelectTag}
      viewOptions={viewOptions}
    />
  )

  if (isGroupsView) {
    return (
      <AppShell sidebar={sidebar}>
        <GroupsBoard
          isLoading={groupsQuery.isLoading || projectsForGroupsQuery.isLoading}
          groups={groupsQuery.data || []}
          projects={projectsForGroupsQuery.data || []}
          onCreateGroup={(payload) => createGroupMutation.mutate(payload)}
          onRenameGroup={(id, name) => renameGroupMutation.mutate({ id, name })}
          onDeleteGroup={(id) => deleteGroupMutation.mutate(id)}
          onAssign={(groupId, projectId) => assignGroupMutation.mutate({ group_id: groupId, project_id: projectId })}
          onUnassign={(projectId) => unassignGroupMutation.mutate(projectId)}
        />
      </AppShell>
    )
  }

  const isModalVisible = modalOpen && !!modalProjectId

  return (
    <>
      <AppShell sidebar={sidebar}>
        <div className="flex flex-col gap-6">
          <FilterBar
            tags={tags}
            tagLabelLookup={tagLabelLookup}
            languages={languages}
            languageOptions={languageOptions}
            onRemoveTag={handleRemoveTag}
            onAddTag={handleAddTag}
            onToggleLanguage={handleToggleLanguage}
            updatedPreset={updatedPreset}
            onUpdatedChange={handleUpdatedChange}
            owner={owner}
            onOwnerChange={handleOwnerChange}
            onReset={handleResetFilters}
          />
          <DensityControls density={density} onDensityChange={handleDensityChange} />
          {projectsQuery.isLoading ? (
            <ProjectGridSkeleton />
          ) : allProjects.length === 0 ? (
            <EmptyState onReset={handleResetFilters} />
          ) : (
            <ProjectGrid
              projects={allProjects}
              density={density}
              onToggleStar={handleToggleStar}
              onQuickPeek={handleQuickPeek}
              onQuickOpen={handleQuickOpen}
              onEditProject={setEditingProject}
              onManageGroups={setGroupsProject}
              onDeleteProject={setDeleteProject}
            />
          )}
          {projectsQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => projectsQuery.fetchNextPage()}
                disabled={projectsQuery.isFetchingNextPage}
              >
                {projectsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
      {projectModalEnabled && (
        <ProjectDetailModal
          projectId={modalProjectId}
          open={isModalVisible}
          onOpenChange={handleModalOpenChange}
          onAfterClose={handleModalAfterClose}
          onExpand={handleExpandFromModal}
        />
      )}
      <ProjectEditDialog
        projectId={editingProject?.id ?? ''}
        open={Boolean(editingProject)}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null)
        }}
        initialName={editingProject?.name ?? ''}
        initialDescription={editingProject?.description ?? ''}
        initialStatus={editingProject?.status ?? 'idea'}
        initialTags={editingProject?.tag_details.map((tag) => tag.label) ?? []}
      />
      <ProjectGroupsDialog
        projectId={groupsProject?.id ?? ''}
        open={Boolean(groupsProject)}
        onOpenChange={(open) => {
          if (!open) setGroupsProject(null)
        }}
        currentGroupIds={groupsProject?.groups.map((group) => group.id) ?? []}
      />
      <Dialog
        open={Boolean(deleteProject)}
        onOpenChange={(open) => {
          if (!open && !deleteProjectMutation.isPending) setDeleteProject(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{deleteProject?.name}</strong> and all associated data.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You can archive instead if you want to keep history. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteProject(null)}
              disabled={deleteProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteProject && deleteProjectMutation.mutate(deleteProject.id)}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DashboardSidebar({
  activeView,
  tags,
  availableTags,
  onChangeView,
  onSelectTag,
  viewOptions,
}: {
  activeView: string
  tags: string[]
  availableTags: Array<{ slug: string; label: string; count: number }>
  onChangeView: (view: string) => void
  onSelectTag: (tag: string) => void
  viewOptions: Array<{ id: string; label: string }>
}) {
  const isTagView = activeView === 'tag'
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 text-xs uppercase text-muted-foreground">Views</div>
        <nav className="flex flex-col gap-1 text-sm">
          {viewOptions.map((view) => {
            const active = activeView === view.id
            return (
              <button
                key={view.id}
                className={cn(
                  'flex items-center justify-between rounded px-2 py-1 text-left transition hover:bg-accent',
                  active && 'bg-accent text-primary'
                )}
                onClick={() => onChangeView(view.id)}
              >
                <span>{view.label}</span>
                {active && <ChevronMarker />}
              </button>
            )
          })}
          <button
            className={cn(
              'flex items-center justify-between rounded px-2 py-1 text-left transition hover:bg-accent',
              isTagView && 'bg-accent text-primary'
            )}
            onClick={() => onChangeView('tag')}
          >
            <span>By Tag</span>
            {isTagView && <ChevronMarker />}
          </button>
        </nav>
      </div>
      <div>
        <div className="mb-2 text-xs uppercase text-muted-foreground">Top Tags</div>
        <div className="space-y-1 text-sm">
          {(availableTags || []).slice(0, 10).map((tag) => {
            const active = tags.includes(tag.slug)
            return (
              <button
                key={tag.slug}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1 text-left transition hover:bg-accent',
                  active && 'bg-accent text-primary'
                )}
                onClick={() => onSelectTag(tag.slug)}
              >
                <span className="truncate">#{tag.label}</span>
                <span className="text-xs text-muted-foreground">{tag.count}</span>
              </button>
            )
          })}
          {availableTags.length === 0 && <div className="text-xs text-muted-foreground">No tags yet</div>}
        </div>
      </div>
    </div>
  )
}

function ChevronMarker() {
  return <span className="text-xs text-primary">●</span>
}

function FilterBar({
  tags,
  tagLabelLookup,
  languages,
  languageOptions,
  onRemoveTag,
  onAddTag,
  onToggleLanguage,
  updatedPreset,
  onUpdatedChange,
  owner,
  onOwnerChange,
  onReset,
}: {
  tags: string[]
  tagLabelLookup: Record<string, string>
  languages: string[]
  languageOptions: string[]
  onRemoveTag: (tag: string) => void
  onAddTag: () => void
  onToggleLanguage: (language: string) => void
  updatedPreset: string
  onUpdatedChange: (preset: string) => void
  owner: string
  onOwnerChange: (value: string) => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters</span>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase text-muted-foreground">Tags</span>
        {tags.map((tag) => {
          const label = tagLabelLookup[tag] || tag
          return (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              #{label}
              <button className="text-xs" onClick={() => onRemoveTag(tag)} aria-label={`Remove ${label}`}>
              ×
            </button>
            </Badge>
          )
        })}
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onAddTag}>
          Add tag
        </Button>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
            Languages {languages.length ? `(${languages.length})` : ''}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuLabel>Languages</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {languageOptions.length === 0 ? (
            <div className="px-2 py-1 text-sm text-muted-foreground">No data</div>
          ) : (
            languageOptions.map((lang) => (
              <DropdownMenuCheckboxItem
                key={lang}
                checked={languages.includes(lang)}
                onCheckedChange={() => onToggleLanguage(lang)}
              >
                {lang}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
            Updated
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          <DropdownMenuLabel>Last updated</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={updatedPreset} onValueChange={onUpdatedChange}>
            {UPDATED_PRESETS.map((preset) => (
              <DropdownMenuRadioItem key={preset.id} value={preset.id}>
                {preset.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
            Owner
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40">
          <DropdownMenuLabel>Owner</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={owner} onValueChange={onOwnerChange}>
            <DropdownMenuRadioItem value="me">Me</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onReset}>
        Reset
      </Button>
    </div>
  )
}

function DensityControls({ density, onDensityChange }: { density: Density; onDensityChange: (value: Density) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-muted-foreground">Scan, filter, and jump into your projects faster.</p>
      </div>
      <div className="flex items-center gap-2">
        {DENSITY_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            size="sm"
            variant={density === opt.id ? 'default' : 'outline'}
            onClick={() => onDensityChange(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="h-48" />
      ))}
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border p-10 text-center">
      <h2 className="text-lg font-semibold">No projects match the current filters</h2>
      <p className="mt-2 text-sm text-muted-foreground">Try adjusting filters or view all projects again.</p>
      <Button className="mt-4" variant="outline" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  )
}

function ProjectGrid({
  projects,
  density,
  onToggleStar,
  onQuickPeek,
  onQuickOpen,
  onEditProject,
  onManageGroups,
  onDeleteProject,
}: {
  projects: ProjectCard[]
  density: Density
  onToggleStar: (project: ProjectCard) => void
  onQuickPeek: (project: ProjectCard) => void
  onQuickOpen: (project: ProjectCard) => void
  onEditProject: (project: ProjectCard) => void
  onManageGroups: (project: ProjectCard) => void
  onDeleteProject: (project: ProjectCard) => void
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        density === 'compact' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      )}
    >
      {projects.map((project) => (
        <ProjectCardItem
          key={project.id}
          project={project}
          density={density}
          onToggleStar={onToggleStar}
          onQuickPeek={onQuickPeek}
          onQuickOpen={onQuickOpen}
          onEditProject={onEditProject}
          onManageGroups={onManageGroups}
          onDeleteProject={onDeleteProject}
        />
      ))}
    </div>
  )
}

function ProjectCardItem({
  project,
  density,
  onToggleStar,
  onQuickPeek,
  onQuickOpen,
  onEditProject,
  onManageGroups,
  onDeleteProject,
}: {
  project: ProjectCard
  density: Density
  onToggleStar: (project: ProjectCard) => void
  onQuickPeek: (project: ProjectCard) => void
  onQuickOpen: (project: ProjectCard) => void
  onEditProject: (project: ProjectCard) => void
  onManageGroups: (project: ProjectCard) => void
  onDeleteProject: (project: ProjectCard) => void
}) {
  const updatedDate = project.updated_at ? new Date(project.updated_at) : null
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-md border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow',
        density === 'compact' && 'p-3'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/projects/${project.slug}`} className="truncate text-lg font-semibold hover:underline">
            {project.name}
          </Link>
          {project.groups.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {project.groups.slice(0, 2).map((group) => (
                <span
                  key={group.id}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5"
                  aria-label={`Group ${group.name}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: group.color || 'var(--primary)' }}
                  />
                  <span className="font-medium text-foreground">{group.name}</span>
                </span>
              ))}
              {project.groups.length > 2 && (
                <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                  +{project.groups.length - 2}
                </span>
              )}
            </div>
          )}
          {density !== 'compact' && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description || 'No description yet.'}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              'rounded border px-2 py-1 text-xs transition',
              project.is_starred
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:border-border'
            )}
            onClick={() => onToggleStar(project)}
            aria-label={project.is_starred ? 'Unstar project' : 'Star project'}
          >
            <Star className={cn('h-4 w-4', project.is_starred && 'fill-current')} />
          </button>
          <ProjectActionsMenu
            onEdit={() => onEditProject(project)}
            onManageGroups={() => onManageGroups(project)}
            onDelete={() => onDeleteProject(project)}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{project.status}</span>
        {updatedDate && <span>· Updated {updatedDate.toLocaleDateString()}</span>}
        <span>· {project.file_count} files</span>
      </div>
      {project.tag_details.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {project.tag_details.map((tag) => (
            <Badge key={tag.slug} variant="outline" className="text-xs">
              #{tag.label}
            </Badge>
          ))}
        </div>
      )}
      {density !== 'compact' && project.language_mix.length > 0 && (
        <LanguageBar stats={project.language_mix} />
      )}
      {density === 'rich' && project.highlight && (
        <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="text-xs uppercase text-muted-foreground">Highlight</div>
          <div className="mt-1 font-medium">{project.highlight.title || project.highlight.path}</div>
          {project.highlight.snippet && <p className="mt-1 text-muted-foreground">{project.highlight.snippet}</p>}
        </div>
      )}
      {density === 'rich' && project.activity_sparkline.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs uppercase text-muted-foreground">Recent Activity</div>
          <ActivitySparkline data={project.activity_sparkline} />
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
        <Button size="sm" variant="secondary" onClick={() => onQuickPeek(project)}>
          <Eye className="mr-2 h-4 w-4" /> Quick peek
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onQuickOpen(project)}>
          <ExternalLink className="mr-2 h-4 w-4" /> Open
        </Button>
      </div>
    </div>
  )
}

function LanguageBar({ stats }: { stats: ProjectCardLanguageStat[] }) {
  if (!stats.length) return null
  const total = stats.reduce((sum, item) => sum + item.count, 0)
  if (!total) return null
  return (
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded bg-muted">
        {stats.map((stat) => (
          <div
            key={stat.language}
            className="bg-primary/70 first:rounded-l last:rounded-r"
            style={{ width: `${Math.max((stat.count / total) * 100, 4)}%` }}
            title={`${stat.language} · ${stat.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {stats.map((stat) => (
          <span key={stat.language}>
            {stat.language} ({stat.count})
          </span>
        ))}
      </div>
    </div>
  )
}

function ActivitySparkline({ data }: { data: number[] }) {
  if (!data.length) return null
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-1">
      {data.map((val, idx) => (
        <div
          key={idx}
          className="w-2 rounded bg-primary/50"
          style={{ height: `${max ? ((val || 1) / max) * 32 : 8}px` }}
          title={`${val} updates`}
        />
      ))}
    </div>
  )
}

type DnDPayload = {
  project_id: string
  from_group_id: string | null
}

interface GroupsBoardProps {
  isLoading: boolean
  groups: ProjectGroupWithProjects[]
  projects: Project[]
  onCreateGroup: (payload: { name: string; color?: string | null }) => void
  onRenameGroup: (id: string, name: string) => void
  onDeleteGroup: (id: string) => void
  onAssign: (groupId: string, projectId: string) => void
  onUnassign: (projectId: string) => void
}

function GroupsBoard({
  isLoading,
  groups,
  projects,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onAssign,
  onUnassign,
}: GroupsBoardProps) {
  const groupedIds = React.useMemo(
    () => new Set(groups.flatMap((g) => g.projects.map((p) => p.id))),
    [groups],
  )
  const ungrouped = React.useMemo(() => projects.filter((p) => !groupedIds.has(p.id)), [projects, groupedIds])

  const handleDragStart = (e: React.DragEvent, payload: DnDPayload) => {
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  const extractPayload = (e: React.DragEvent): DnDPayload | null => {
    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return null
      return JSON.parse(raw) as DnDPayload
    } catch {
      return null
    }
  }

  const handleDropGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    const payload = extractPayload(e)
    if (payload && payload.project_id) {
      onAssign(groupId, payload.project_id)
    }
  }

  const handleDropUngrouped = (e: React.DragEvent) => {
    e.preventDefault()
    const payload = extractPayload(e)
    if (payload && payload.project_id) {
      onUnassign(payload.project_id)
    }
  }

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCreateClick = () => {
    const name = window.prompt('New group name?')
    if (!name) return
    onCreateGroup({ name })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Project Groups</h1>
          <p className="text-sm text-muted-foreground">Drag projects between columns to organize workstreams.</p>
        </div>
        <Button variant="outline" onClick={handleCreateClick}>
          New Group
        </Button>
      </div>
      {isLoading ? (
        <ProjectGridSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div onDragOver={allowDrop} onDrop={handleDropUngrouped} className="rounded-md border p-3">
            <GroupHeader title="Ungrouped" />
            <div className="flex flex-col gap-2">
              {ungrouped.map((project) => (
                <GroupProjectCard
                  key={project.id}
                  project={project}
                  onDragStart={(e) => handleDragStart(e, { project_id: project.id, from_group_id: null })}
                />
              ))}
              {ungrouped.length === 0 && <EmptyPlaceholder label="No ungrouped projects" />}
            </div>
          </div>
          {groups.map((group) => (
            <div
              key={group.id}
              onDragOver={allowDrop}
              onDrop={(e) => handleDropGroup(e, group.id)}
              className="rounded-md border p-3"
            >
              <GroupHeader
                title={group.name}
                color={group.color}
                onRename={() => {
                  const name = window.prompt('Rename group', group.name)
                  if (name) onRenameGroup(group.id, name)
                }}
                onDelete={() => onDeleteGroup(group.id)}
              />
              <div className="flex flex-col gap-2">
                {group.projects.map((project) => (
                  <GroupProjectCard
                    key={project.id}
                    project={project as Project}
                    onDragStart={(e) => handleDragStart(e, { project_id: project.id, from_group_id: group.id })}
                  />
                ))}
                {group.projects.length === 0 && <EmptyPlaceholder label="Drop projects here" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GroupHeader({
  title,
  color,
  onRename,
  onDelete,
}: {
  title: string
  color?: string | null
  onRename?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: color || 'var(--muted)' }}
        />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {onRename && onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 hover:bg-accent" aria-label="Group actions">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onRename() }}>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); onDelete() }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function GroupProjectCard({ project, onDragStart }: { project: Project; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      className="rounded-md border bg-card p-3 text-sm hover:bg-accent/30"
      draggable
      onDragStart={onDragStart}
    >
      <div className="flex items-center justify-between gap-2">
        <a href={`/projects/${project.slug}`} className="truncate font-medium hover:underline">
          {project.name}
        </a>
        <Badge variant="secondary">{project.status}</Badge>
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{project.description}</div>
    </div>
  )
}

function EmptyPlaceholder({ label }: { label: string }) {
  return <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">{label}</div>
}
