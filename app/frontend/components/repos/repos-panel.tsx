"use client"
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RepoItem, RepoSchema, RepoStatus, RepoStatusSchema } from '@/lib/types'

export function ReposPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const repos = useQuery({
    queryKey: ['repos', projectId],
    queryFn: async () => {
      const rows = await apiGet<any[]>(`/repos?project_id=${projectId}`)
      return rows.map((r) => RepoSchema.parse(r)) as RepoItem[]
    },
  })

  const createLocal = useMutation({
    mutationFn: async () =>
      apiJson<RepoItem>('POST', `/repos`, {
        scope: 'project',
        project_id: projectId,
        provider: 'local',
        name: 'artifacts',
        visibility: 'private',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repos', projectId] }),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Repos</CardTitle>
          <Button size="sm" onClick={() => createLocal.mutate()} disabled={createLocal.isPending}>Connect Local</Button>
        </div>
      </CardHeader>
      <CardContent>
        {repos.data && repos.data.length === 0 && <div className="text-sm text-muted-foreground">No repos yet.</div>}
        {repos.data && repos.data.length > 0 && (
          <div className="space-y-3">
            {repos.data.map((r) => (
              <RepoRow key={r.id} repo={r} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RepoRow({ repo }: { repo: RepoItem }) {
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [loading, setLoading] = useState(false)
  async function refresh() {
    setLoading(true)
    try {
      const st = RepoStatusSchema.parse(await apiGet(`/repos/${repo.id}/status`))
      setStatus(st)
    } finally {
      setLoading(false)
    }
  }
  async function pull() {
    await apiJson('POST', `/repos/${repo.id}/pull`, {})
    await refresh()
  }
  async function push() {
    await apiJson('POST', `/repos/${repo.id}/push`, {})
    await refresh()
  }
  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{repo.name} <span className="text-xs text-muted-foreground">({repo.provider})</span></div>
          <div className="text-xs text-muted-foreground truncate max-w-xl">{repo.repo_url || '(local)'}</div>
          {status && (
            <div className="mt-1 text-xs">branch {status.branch || '—'} • ahead {status.ahead} • behind {status.behind} • {status.dirty ? 'dirty' : 'clean'}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={refresh} disabled={loading}>Status</Button>
          <Button size="sm" onClick={pull} disabled={loading}>Pull</Button>
          <Button size="sm" onClick={push} disabled={loading}>Push</Button>
        </div>
      </div>
    </div>
  )
}

