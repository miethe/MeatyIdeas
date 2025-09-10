"use client"
import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMutation } from '@tanstack/react-query'
import { apiJson } from '@/lib/apiClient'
import { toast } from 'sonner'

export function ArtifactsPanel({ projectId }: { projectId: string }) {
  const connect = useMutation({
    mutationFn: async () => apiJson('POST', `/projects/${projectId}/artifacts/connect`, { provider: 'local', visibility: 'private' }),
    onSuccess: () => toast.success('Artifacts repo connected'),
    onError: () => toast.error('Failed to connect artifacts repo'),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Artifacts</CardTitle>
        <CardDescription>Connect a repo to sync rendered documents.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Status: Not connected</div>
        <Button onClick={() => connect.mutate()}>Connect repo</Button>
      </CardContent>
    </Card>
  )
}

