"use client"
import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { apiGet, apiJson } from '@/lib/apiClient'
import { AppShell } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/skeleton'
import { Project, ProjectSchema } from '@/lib/types'
import { normalizeFiles, NormalizedFile } from '@/lib/files/normalizeFile'
import { ItemModalViewer } from '@/components/item-modal-viewer'
import { FileCreateDialog } from '@/components/files/file-create-dialog'
import { Button } from '@/components/ui/button'
import { span } from '@/lib/telemetry'
import { ArtifactsPanel } from '@/components/artifacts-panel'
import { ReposPanel } from '@/components/repos/repos-panel'
import { ExportBundleWizard } from '@/components/bundles/export-bundle-wizard'
import { ImportDialog } from '@/components/projects/import-dialog'
import { ShareLinksDialog } from '@/components/projects/share-links-dialog'
import { BundlesHistory } from '@/components/bundles/bundles-history'
import { ProjectEvents } from '@/components/projects/project-events'
import { FileTree } from '@/components/files/file-tree'
import { FileIcon } from '@/components/files/file-icon'
import { TagChip, OverflowTagChip } from '@/components/tags/tag-chip'
import { FileMetadataList } from '@/components/files/file-metadata-list'
import { ProjectActionsMenu } from '@/components/projects/project-actions-menu'
import { ProjectEditDialog } from '@/components/projects/project-edit-dialog'
import { ProjectGroupsDialog } from '@/components/projects/project-groups-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

export default function ProjectPage() {
  const params = useParams<{ project: string }>()
  const search = useSearchParams()
  const openFileId = search.get('file')
  const projectParam = params.project
  const [projectId, setProjectId] = useState<string | null>(null)
  const [selected, setSelected] = useState<NormalizedFile | null>(null)
  const [gitEnabled, setGitEnabled] = useState(false)
  const [shareEnabled, setShareEnabled] = useState(false)
  const [dirsEnabled, setDirsEnabled] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const router = useRouter()
  const qc = useQueryClient()

  const projList = useQuery({
    queryKey: ['projects-nav'],
    queryFn: async () => {
      const payload = await apiGet<any>(`/projects?limit=200&view=all`)
      if (Array.isArray(payload)) return payload
      if (payload && Array.isArray(payload.projects)) return payload.projects
      return []
    },
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

  useEffect(() => {
    setEditOpen(false)
    setGroupsOpen(false)
    setDeleteOpen(false)
  }, [projectId])

  const proj = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => ProjectSchema.parse(await apiGet<Project>(`/projects/${projectId}`)),
    enabled: !!projectId,
  })
  const files = useQuery({
    queryKey: ['files', projectId],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/projects/${projectId}/files`)
      return normalizeFiles(rows)
    },
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiJson('DELETE', `/projects/${id}`, null)
    },
    onSuccess: (_, id) => {
      toast.success('Project deleted')
      setDeleteOpen(false)
      qc.invalidateQueries({ queryKey: ['projects-nav'] })
      qc.invalidateQueries({ queryKey: ['dashboard-projects'] })
      qc.invalidateQueries({ queryKey: ['project', id] })
      router.push('/')
    },
    onError: () => {
      toast.error('Unable to delete project')
    },
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

  useEffect(() => {
    import('@/lib/config').then(({ getConfig }) => getConfig().then((cfg) => {
      setGitEnabled((cfg.GIT_INTEGRATION || 0) === 1)
      setShareEnabled((cfg.SHARE_LINKS || 0) === 1)
      setDirsEnabled((cfg.DIRS_PERSIST || 0) === 1)
    }))
  }, [])

  return (
    <AppShell>
      {projectId && <ProjectEvents projectId={projectId} />}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{proj.data?.name || 'Project'}</h1>
          {proj.data?.groups && proj.data.groups.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {proj.data.groups.map((group) => (
                <Badge key={group.id} variant="outline" className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color || 'var(--primary)' }} />
                  <span className="font-medium text-foreground">{group.name}</span>
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-muted-foreground">{proj.data?.description || 'No description yet.'}</p>
        </div>
        {projectId && proj.data && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <ImportDialog projectId={projectId || undefined}>
              <Button variant="outline">Import</Button>
            </ImportDialog>
            {shareEnabled && (
              <ShareLinksDialog projectId={projectId || ''}>
                <Button variant="outline">Share</Button>
              </ShareLinksDialog>
            )}
            <ExportBundleWizard projectId={projectId} />
            <FileCreateDialog projectId={projectId}>
              <Button>New File</Button>
            </FileCreateDialog>
            <ProjectActionsMenu
              onEdit={() => setEditOpen(true)}
              onManageGroups={() => setGroupsOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        )}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {projectId && gitEnabled ? <ReposPanel projectId={projectId} /> : projectId && <ArtifactsPanel projectId={projectId} />}
        {projectId && <BundlesHistory projectId={projectId} />}
      </div>
      {projectId && dirsEnabled && (
        <div className="mb-6">
          <FileTree projectId={projectId} onOpenFile={(fid) => setSelected(files.data?.find((x) => x.id === fid) || null)} />
        </div>
      )}
      {files.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : files.data && files.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.data.map((f) => {
            const tags = f.tag_details?.slice(0, 3) ?? []
            const overflowTags = f.tag_details && f.tag_details.length > 3 ? f.tag_details.slice(3) : []
            const extension = f.path.includes('.') ? (f.path.split('.').pop()?.toLowerCase() ?? null) : null
            const statusField = f.metadataByKey?.status
            return (
              <Card
                key={f.id}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
                onClick={() => {
                  span('ui.open.item_modal', { file_id: f.id })
                  setSelected(f)
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <FileIcon type="file" hint={f.icon_hint || extension} extension={extension} className="mt-1 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base font-semibold">{f.title}</CardTitle>
                      <div className="truncate text-xs text-muted-foreground">{f.path}</div>
                      {statusField && (
                        <Badge variant="outline" className="mt-2 text-[10px] uppercase">
                          {statusField.value}
                        </Badge>
                      )}
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <TagChip key={tag.slug} tag={tag} maxWidth={120} />
                          ))}
                          {overflowTags.length > 0 && <OverflowTagChip overflow={overflowTags} />}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="min-h-[2.5rem] text-sm text-muted-foreground">
                    {f.summary || 'No description yet.'}
                  </p>
                  {Array.isArray(f.metadata_fields) && f.metadata_fields.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <FileMetadataList fields={f.metadata_fields} maxVisible={3} dense />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">No files yet.</div>
      )}

      <ItemModalViewer file={selected} onClose={() => setSelected(null)} projectId={projectId || undefined} />
      <ProjectEditDialog
        projectId={proj.data?.id ?? ''}
        open={editOpen && Boolean(proj.data)}
        onOpenChange={(open) => setEditOpen(open)}
        initialName={proj.data?.name ?? ''}
        initialDescription={proj.data?.description ?? ''}
        initialStatus={proj.data?.status ?? 'idea'}
        initialTags={proj.data?.tags ?? []}
        onSaved={() => {
          proj.refetch()
          projList.refetch()
        }}
      />
      <ProjectGroupsDialog
        projectId={proj.data?.id ?? ''}
        open={groupsOpen && Boolean(proj.data)}
        onOpenChange={(open) => setGroupsOpen(open)}
        currentGroupIds={proj.data?.groups?.map((group) => group.id) ?? []}
        onSaved={() => {
          proj.refetch()
          projList.refetch()
        }}
      />
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteOpen(false)
          if (open) setDeleteOpen(true)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{proj.data?.name}</strong> and all associated files.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Consider archiving instead if you want to retain history. Deletions cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!proj.data) return
                deleteMutation.mutate(proj.data.id)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
