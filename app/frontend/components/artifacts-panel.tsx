"use client"
import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Status = { provider: string, repo_url?: string | null, branch?: string | null, ahead: number, behind: number, last_sync?: string | null }
type Commit = { sha: string, author?: string | null, message: string, date: string }

function CommitDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false)
  const [paths, setPaths] = React.useState<string>('files')
  const [message, setMessage] = React.useState<string>('chore: update artifacts')
  const [push, setPush] = React.useState<boolean>(true)
  const commitMut = useMutation({
    mutationFn: async () => apiJson('POST', `/projects/${projectId}/artifacts/commit`, { paths: paths.split(',').map(s => s.trim()).filter(Boolean), message, push }),
    onSuccess: () => { toast.success('Commit complete'); setOpen(false) },
    onError: () => toast.error('Commit failed'),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Commit & Push</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit & Push</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <div className="w-28 text-right text-muted-foreground">Paths</div>
            <input className="flex-1 rounded border bg-background px-2 py-1" value={paths} onChange={(e) => setPaths(e.target.value)} placeholder="files, artifacts/assets" />
          </label>
          <label className="flex items-center gap-2">
            <div className="w-28 text-right text-muted-foreground">Message</div>
            <input className="flex-1 rounded border bg-background px-2 py-1" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <label className="flex items-center gap-2">
            <div className="w-28 text-right text-muted-foreground">Push</div>
            <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>Commit</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConnectRepoDialog({ projectId, onConnected }: { projectId: string, onConnected?: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [provider, setProvider] = React.useState<'local' | 'github'>('local')
  const [visibility, setVisibility] = React.useState<'private' | 'public'>('private')
  const [repoUrl, setRepoUrl] = React.useState('')
  const connectMut = useMutation({
    mutationFn: async () => apiJson('POST', `/projects/${projectId}/artifacts/connect`, { provider, visibility, repo_url: provider === 'local' ? null : repoUrl }),
    onSuccess: () => { toast.success('Artifacts repo connected'); setOpen(false); onConnected?.() },
    onError: (err: any) => {
      const msg = err?.status === 400 ? 'Invalid repo or auth' : 'Failed to connect artifacts repo'
      toast.error(msg)
    },
  })
  const canSubmit = provider === 'local' || (provider !== 'local' && repoUrl.trim().length > 0)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Connect repo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Artifacts Repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <div className="w-28 text-right text-muted-foreground">Provider</div>
            <select className="flex-1 rounded border bg-background px-2 py-1" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
              <option value="local">Local</option>
              <option value="github">GitHub</option>
            </select>
          </label>
          {provider !== 'local' && (
            <label className="flex items-center gap-2">
              <div className="w-28 text-right text-muted-foreground">Repo URL</div>
              <input className="flex-1 rounded border bg-background px-2 py-1" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="git@github.com:org/repo.git" />
            </label>
          )}
          <label className="flex items-center gap-2">
            <div className="w-28 text-right text-muted-foreground">Visibility</div>
            <select className="flex-1 rounded border bg-background px-2 py-1" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => connectMut.mutate()} disabled={!canSubmit || connectMut.isPending}>Connect</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ArtifactsPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const status = useQuery({
    queryKey: ['artifacts-status', projectId],
    queryFn: async () => apiGet<Status>(`/projects/${projectId}/artifacts/status`),
    enabled: !!projectId,
    refetchInterval: 5000,
  })
  const history = useQuery({
    queryKey: ['artifacts-history', projectId],
    queryFn: async () => apiGet<Commit[]>(`/projects/${projectId}/artifacts/history?limit=10`),
    enabled: !!projectId,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Artifacts</CardTitle>
        <CardDescription>Connect a repo to sync rendered documents.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {status.isLoading ? 'Loading…' : status.data?.branch ? (
              <span>Branch <span className="font-medium text-foreground">{status.data.branch}</span> • Ahead {status.data.ahead} / Behind {status.data.behind}</span>
            ) : 'Not connected'}
          </div>
          <div className="flex items-center gap-2">
            <ConnectRepoDialog projectId={projectId} onConnected={() => { qc.invalidateQueries({ queryKey: ['artifacts-status', projectId] }); qc.invalidateQueries({ queryKey: ['artifacts-history', projectId] }) }} />
            <CommitDialog projectId={projectId} />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Recent Commits</div>
          <div className="rounded border divide-y">
            {history.isLoading && <div className="text-sm text-muted-foreground p-2">Loading…</div>}
            {history.data?.length === 0 && <div className="text-sm text-muted-foreground p-2">No commits yet.</div>}
            {history.data?.map(c => (
              <div key={c.sha} className="p-2 text-sm">
                <div className="truncate font-medium">{c.message}</div>
                <div className="text-xs text-muted-foreground">{c.sha.slice(0, 7)} • {c.author || 'unknown'} • {new Date(c.date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
