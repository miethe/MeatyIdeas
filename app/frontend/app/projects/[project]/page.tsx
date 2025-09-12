"use client"
import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/apiClient'
import { AppShell } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/skeleton'
import { FileItem, FileSchema, Project, ProjectSchema } from '@/lib/types'
import { ItemModalViewer } from '@/components/item-modal-viewer'
import { FileCreateDialog } from '@/components/files/file-create-dialog'
import { Button } from '@/components/ui/button'
import { span } from '@/lib/telemetry'
import { ArtifactsPanel } from '@/components/artifacts-panel'
import { ExportBundleWizard } from '@/components/bundles/export-bundle-wizard'
import { BundlesHistory } from '@/components/bundles/bundles-history'
import { ProjectEvents } from '@/components/projects/project-events'

export default function ProjectPage() {
  const params = useParams<{ project: string }>()
  const search = useSearchParams()
  const openFileId = search.get('file')
  const projectParam = params.project
  const [projectId, setProjectId] = useState<string | null>(null)
  const [selected, setSelected] = useState<FileItem | null>(null)

  const projList = useQuery({
    queryKey: ['projects'],
    queryFn: async () => apiGet<any[]>(`/projects`),
  })

  useEffect(() => {
    if (!projectParam) return
    const isUuid = /^[0-9a-fA-F-]{16,}$/.test(projectParam)
    if (isUuid) setProjectId(projectParam)
    else if (projList.data) {
      const found = projList.data.find((p: any) => p.slug === projectParam)
      if (found) setProjectId(found.id)
    }
  }, [projectParam, projList.data])

  const proj = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => ProjectSchema.parse(await apiGet<Project>(`/projects/${projectId}`)),
    enabled: !!projectId,
  })
  const files = useQuery({
    queryKey: ['files', projectId],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/projects/${projectId}/files`)
      return rows.map((r) => FileSchema.parse(r)) as FileItem[]
    },
    enabled: !!projectId,
  })

  useEffect(() => {
    if (openFileId && files.data) {
      const f = files.data.find((x) => x.id === openFileId)
      if (f) setSelected(f)
    }
  }, [openFileId, files.data])

  useEffect(() => {
    if (projectId) span('ui.click.project', { id: projectId })
  }, [projectId])

  return (
    <AppShell>
      {projectId && <ProjectEvents projectId={projectId} />}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{proj.data?.name || 'Project'}</h1>
          <p className="text-muted-foreground">{proj.data?.description}</p>
        </div>
        {projectId && (
          <div className="flex items-center gap-2">
            <ExportBundleWizard projectId={projectId} />
            <FileCreateDialog projectId={projectId}>
              <Button>New File</Button>
            </FileCreateDialog>
          </div>
        )}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {projectId && <ArtifactsPanel projectId={projectId} />}
        {projectId && <BundlesHistory projectId={projectId} />}
      </div>
      {files.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : files.data && files.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.data.map((f) => (
            <Card key={f.id} className="cursor-pointer hover:bg-accent/30" onClick={() => { span('ui.open.item_modal', { file_id: f.id }); setSelected(f) }}>
              <CardHeader>
                <CardTitle className="truncate">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="truncate">{f.path}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">No files yet.</div>
      )}

      <ItemModalViewer file={selected} onClose={() => setSelected(null)} projectId={projectId || undefined} />
    </AppShell>
  )
}
