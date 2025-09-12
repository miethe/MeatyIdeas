"use client"
import React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiJson, getApiBase, getToken } from '@/lib/apiClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Bundle = {
  id: string
  project_id: string
  status: string
  output_path: string
  branch?: string | null
  pr_url?: string | null
  created_at: string
}

export function BundlesHistory({ projectId }: { projectId: string }) {
  const bundles = useQuery({
    queryKey: ['bundles', projectId],
    queryFn: async () => apiGet<Bundle[]>(`/projects/${projectId}/bundles`),
    enabled: !!projectId,
    refetchInterval: 5000,
  })

  const verify = useMutation({
    mutationFn: async (id: string) => apiJson('POST', `/bundles/${id}/verify`, {}),
    onSuccess: (res: any) => { res?.ok ? toast.success('Bundle verified') : toast.error(`Issues: ${(res?.issues || []).join(', ')}`) },
    onError: () => toast.error('Verification failed'),
  })

  const downloadUrl = (id: string) => `${getApiBase()}/bundles/${id}/download?token=${encodeURIComponent(getToken())}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bundles</CardTitle>
      </CardHeader>
      <CardContent>
        {bundles.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {bundles.data && bundles.data.length === 0 && <div className="text-sm text-muted-foreground">No bundles yet.</div>}
        <div className="space-y-2">
          {bundles.data?.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded border p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{b.status.toUpperCase()} • {new Date(b.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground truncate">{b.branch ? `Branch: ${b.branch}` : 'No branch'}</div>
                {b.pr_url && <a className="text-xs text-blue-400 underline" href={b.pr_url} target="_blank">Open PR</a>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => verify.mutate(b.id)} disabled={verify.isPending}>Verify</Button>
                <a href={downloadUrl(b.id)}><Button size="sm" disabled={!b.output_path || b.status !== 'completed'}>Download</Button></a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

