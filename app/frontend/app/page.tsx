"use client"

import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/apiClient'
import { Project, ProjectSchema } from '@/lib/types'
import { AppShell } from '@/components/app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/skeleton'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'
import { span } from '@/lib/telemetry'
import { ProjectEditDialog } from '@/components/projects/project-edit-dialog'

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

  useEffect(() => {
    if (!isLoading) span('ui.load.projects', { count: data?.length || 0 })
  }, [isLoading])

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-muted-foreground">API-backed Markdown projects. OpenAPI at /api/docs.</p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">No projects yet. Create one with the New button.</div>
      ) : (
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
      )}
    </AppShell>
  )
}
