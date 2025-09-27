"use client"
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { RichEditor } from '@/components/editor/rich-editor'
import { apiGet } from '@/lib/apiClient'

export default function EditorPage() {
  const params = useParams<{ project: string; file: string }>()
  const projectParam = params.project
  const file = params.file
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    async function resolveProject() {
      const isUuid = /^[0-9a-fA-F-]{16,}$/.test(projectParam)
      if (isUuid) {
        setProjectId(projectParam)
        return
      }
        const payload = await apiGet<any>(`/projects`)
        let rows = [];
        if (Array.isArray(payload)) rows = payload;
        else if (payload && Array.isArray(payload.projects)) rows = payload.projects;
    const found = rows.find((p: any) => p.slug === projectParam);
        if (found) setProjectId(found.id);
    }
    resolveProject()
  }, [projectParam])

  return (
    <AppShell currentProjectId={projectId}>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Editor</h1>
        <p className="text-sm text-muted-foreground">Split view with live preview, attachments, and backlinks.</p>
      </div>
      {projectId && <RichEditor projectId={projectId} fileId={file} />}
    </AppShell>
  )
}
