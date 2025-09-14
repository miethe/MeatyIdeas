"use client"
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiGet, apiJson } from '@/lib/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type ShareLink = {
  id: string
  project_id: string
  token: string
  permissions: string
  expires_at?: string | null
  revoked_at?: string | null
  created_at: string
}

export function ShareLinksDialog({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['share-links', projectId, open], queryFn: async () => (open ? apiGet<ShareLink[]>(`/projects/${projectId}/share-links`) : []), enabled: !!projectId })
  const create = useMutation({
    mutationFn: async (expiresAt: string | null) => apiJson<ShareLink>('POST', `/projects/${projectId}/share-links`, { expires_at: expiresAt }),
    onSuccess: (sl) => {
      qc.invalidateQueries({ queryKey: ['share-links', projectId] })
      const url = `${window.location.origin}/share/${sl.token}`
      navigator.clipboard.writeText(url).catch(() => {})
      toast('Share link created', { description: 'Copied to clipboard' })
    },
    onError: () => toast.error('Failed to create share link'),
  })
  const revoke = useMutation({
    mutationFn: async (id: string) => apiJson<void>('DELETE', `/share-links/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-links', projectId] }),
    onError: () => toast.error('Failed to revoke share link'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Links</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Button onClick={() => create.mutate(null)} disabled={create.isPending}>Create</Button>
          <Button variant="outline" onClick={() => {
            const days = prompt('Expire in N days (empty for none)')
            if (days === null) return
            const n = parseInt(days)
            if (isNaN(n)) return create.mutate(null)
            const dtStr = new Date(Date.now() + n * 86400000).toISOString()
            create.mutate(dtStr)
          }}>Create with expiry…</Button>
        </div>
        <div className="max-h-64 overflow-auto">
          {list.data && list.data.length > 0 ? (
            <ul className="divide-y">
              {list.data.map((sl) => (
                <li key={sl.id} className="flex items-center gap-2 py-2">
                  <code className="truncate">{`${window.location.origin}/share/${sl.token}`}</code>
                  <span className="text-xs text-muted-foreground">{sl.expires_at ? `expires ${new Date(sl.expires_at).toLocaleString()}` : 'no expiry'}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${sl.token}`)}>Copy</Button>
                    <Button size="sm" variant="destructive" onClick={() => revoke.mutate(sl.id)}>Revoke</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">No share links yet.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

