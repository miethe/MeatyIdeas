"use client"

import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { Project, ProjectSchema, ProjectGroupWithProjects, ProjectGroupWithProjectsSchema } from '@/lib/types'
import { AppShell } from '@/components/app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/skeleton'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { span } from '@/lib/telemetry'
import { ProjectEditDialog } from '@/components/projects/project-edit-dialog'
import { getConfig } from '@/lib/config'

type DnDPayload = { project_id: string; from_group_id: string | null }

export default function Page() {
  const qc = useQueryClient()
  const del = useMutation({
    mutationFn: async (id: string) => apiJson('DELETE', `/projects/${id}`, null as any),
    onSuccess: () => {
      toast.success('Project deleted')
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => toast.error('Failed to delete project'),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/projects`)
      return rows.map((r) => ProjectSchema.parse(r)) as Project[]
    },
    staleTime: 5_000,
  })
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: 60_000 })
  const { data: groups } = useQuery({
    queryKey: ['project-groups'],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/project-groups`)
      return rows.map((r) => ProjectGroupWithProjectsSchema.parse(r)) as ProjectGroupWithProjects[]
    },
    enabled: (config?.GROUPS_UI || 0) === 1,
    staleTime: 5_000,
  })

  const createGroup = useMutation({
    mutationFn: async (params: { name: string; color?: string | null }) =>
      apiJson('POST', `/project-groups`, params as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })
  const renameGroup = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => apiJson('PATCH', `/project-groups/${id}`, { name } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })
  const deleteGroup = useMutation({
    mutationFn: async (id: string) => apiJson('DELETE', `/project-groups/${id}`, null as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })
  const assignMutation = useMutation({
    mutationFn: async ({ group_id, project_id, position }: { group_id: string; project_id: string; position?: number }) =>
      apiJson('POST', `/project-groups/${group_id}/assign`, { project_id, position } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })
  const unassignMutation = useMutation({
    mutationFn: async (project_id: string) => apiJson('DELETE', `/project-groups/assign/${project_id}`, null as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-groups'] }),
  })

  useEffect(() => {
    if (!isLoading) span('ui.load.projects', { count: data?.length || 0 })
  }, [isLoading])

  const renderGroupsUI = () => {
    const groupedIds = new Set<string>(
      (groups || []).flatMap((g) => g.projects.map((p) => p.id))
    )
    const ungrouped = (data || []).filter((p) => !groupedIds.has(p.id))

    const onDragStart = (e: React.DragEvent, payload: DnDPayload) => {
      e.dataTransfer.setData('text/plain', JSON.stringify(payload))
    }
    const onDropToGroup = (e: React.DragEvent, group_id: string) => {
      e.preventDefault()
      try {
        const pl = JSON.parse(e.dataTransfer.getData('text/plain')) as DnDPayload
        assignMutation.mutate({ group_id, project_id: pl.project_id })
      } catch {
        /* ignore */
      }
    }
    const onDropToUngrouped = (e: React.DragEvent) => {
      e.preventDefault()
      try {
        const pl = JSON.parse(e.dataTransfer.getData('text/plain')) as DnDPayload
        unassignMutation.mutate(pl.project_id)
      } catch {}
    }
    const allowDrop = (e: React.DragEvent) => e.preventDefault()

    const Header = ({ title, color, actions }: { title: string; color?: string | null; actions?: React.ReactNode }) => (
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {color ? <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} /> : <span className="h-3 w-3 rounded-full bg-muted" />}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {actions}
      </div>
    )

    const ProjectCard = ({ p, from_group_id }: { p: Project; from_group_id: string | null }) => (
      <div
        key={p.id}
        className="rounded-md border bg-card p-3 hover:bg-accent/30"
        draggable
        onDragStart={(e) => onDragStart(e, { project_id: p.id, from_group_id })}
      >
        <div className="flex items-center justify-between gap-2">
          <a href={`/projects/${p.slug}`} className="truncate hover:underline" onClick={() => span('ui.click.project', { id: p.id })}>{p.name}</a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Actions" className="rounded p-1 hover:bg-accent focus-ring">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {groups?.length ? (
                <>
                  {groups.map((g) => (
                    <DropdownMenuItem key={g.id} onSelect={() => assignMutation.mutate({ group_id: g.id, project_id: p.id })}>
                      Move to {g.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {from_group_id ? (
                <DropdownMenuItem onSelect={() => unassignMutation.mutate(p.id)}>
                  Remove from group
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-1 text-xs text-muted-foreground truncate">{p.description}</div>
      </div>
    )

    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground">Organize into groups. Drag projects between columns.</p>
          </div>
          <button
            className="rounded-md border px-3 py-1 text-sm hover:bg-accent focus-ring"
            onClick={() => {
              const name = window.prompt('New group name?')
              if (!name) return
              createGroup.mutate({ name })
            }}
          >
            New Group
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Ungrouped */}
          <div onDragOver={allowDrop} onDrop={onDropToUngrouped}>
            <Header title="Ungrouped" />
            <div className="flex flex-col gap-2">
              {ungrouped.map((p) => (
                <ProjectCard key={p.id} p={p} from_group_id={null} />
              ))}
            </div>
          </div>
          {/* Groups */}
          {groups?.map((g) => (
            <div key={g.id} onDragOver={allowDrop} onDrop={(e) => onDropToGroup(e, g.id)}>
              <Header
                title={g.name}
                color={g.color}
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Group actions" className="rounded p-1 hover:bg-accent focus-ring">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => {
                        const name = window.prompt('Rename group', g.name)
                        if (name) renameGroup.mutate({ id: g.id, name })
                      }}>Rename</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onSelect={() => deleteGroup.mutate(g.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
              <div className="flex flex-col gap-2">
                {g.projects.map((p) => (
                  <ProjectCard key={p.id} p={p as any} from_group_id={g.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">No projects yet. Create one with the New button.</div>
      ) : (
        (config?.GROUPS_UI === 1 ? (
          renderGroupsUI()
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-muted-foreground">API-backed Markdown projects. OpenAPI at /api/docs.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <div key={p.id} className="group">
              <Card className="hover:bg-accent/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <a href={`/projects/${p.slug}`} className="truncate hover:underline" onClick={() => span('ui.click.project', { id: p.id })}>{p.name}</a>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{p.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button aria-label="Actions" className="rounded p-1 hover:bg-accent focus-ring">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <ProjectEditDialog project={p}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
                          </ProjectEditDialog>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onSelect={() => del.mutate(p.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardTitle>
                  <CardDescription className="truncate">{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="truncate">slug: {p.slug}</span>
                    <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
            </div>
          </>
        ))
      )}
    </AppShell>
  )
}
