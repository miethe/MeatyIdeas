"use client"
import React from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { RichEditor } from '@/components/editor/rich-editor'
import { apiGet } from '@/lib/apiClient'

export default function EditorPage() {
  const params = useParams<{ project: string; file: string }>()
  const projectParam = params.project
  const file = params.file
  const [projectId, setProjectId] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function resolveProject() {
      const isUuid = /^[0-9a-fA-F-]{16,}$/.test(projectParam)
      if (isUuid) {
        setProjectId(projectParam)
        return
      }
      const rows = await apiGet<any[]>(`/projects`)
      const found = rows.find((p) => p.slug === projectParam)
      if (found) setProjectId(found.id)
    }
    resolveProject()
  }, [projectParam])

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Editor</h1>
        <p className="text-sm text-muted-foreground">Split view with live preview, attachments, and backlinks.</p>
      </div>
      {projectId && <RichEditor projectId={projectId} fileId={file} />}
    </AppShell>
  )
}
